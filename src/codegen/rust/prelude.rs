// SpecSpec Rust Prelude
// Validation primitives - embedded at top of generated validators

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use regex::Regex;
use zip::ZipArchive;

// === Types ===

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Issue {
    pub path: String,
    pub code: String,
    pub message: String,
}

pub type Issues = Vec<Issue>;
pub type Validator = Box<dyn Fn(&Value, &[String], &mut Issues)>;
pub type FSValidator = Box<dyn Fn(&FSContext, &[String], &mut Issues)>;

#[derive(Debug, Serialize, Deserialize)]
pub struct ValidationResult {
    pub ok: bool,
    pub issues: Issues,
}

fn add_issue(issues: &mut Issues, path: &[String], code: &str, message: &str) {
    issues.push(Issue {
        path: if path.is_empty() { "(root)".to_string() } else { path.join(".") },
        code: code.to_string(),
        message: message.to_string(),
    });
}

// === Primitive Validators ===

pub fn validate_str(
    value: &Value,
    path: &[String],
    issues: &mut Issues,
    min_length: Option<usize>,
    max_length: Option<usize>,
    pattern: Option<&str>,
) {
    match value.as_str() {
        Some(s) => {
            if let Some(min) = min_length {
                if s.len() < min {
                    add_issue(issues, path, "str.too_short",
                        &format!("String length {} is less than minimum {}", s.len(), min));
                }
            }
            if let Some(max) = max_length {
                if s.len() > max {
                    add_issue(issues, path, "str.too_long",
                        &format!("String length {} exceeds maximum {}", s.len(), max));
                }
            }
            if let Some(p) = pattern {
                if let Ok(re) = Regex::new(p) {
                    if !re.is_match(s) {
                        add_issue(issues, path, "str.pattern_mismatch",
                            &format!("String does not match pattern {}", p));
                    }
                }
            }
        }
        None => {
            add_issue(issues, path, "type.mismatch",
                &format!("Expected string, got {:?}", value));
        }
    }
}

pub fn validate_num(
    value: &Value,
    path: &[String],
    issues: &mut Issues,
    min: Option<f64>,
    max: Option<f64>,
    integer: bool,
) {
    let num = if let Some(n) = value.as_f64() {
        n
    } else if let Some(n) = value.as_i64() {
        n as f64
    } else {
        add_issue(issues, path, "type.mismatch",
            &format!("Expected number, got {:?}", value));
        return;
    };

    if integer && num.fract() != 0.0 {
        add_issue(issues, path, "num.not_integer",
            &format!("Expected integer, got {}", num));
    }
    if let Some(m) = min {
        if num < m {
            add_issue(issues, path, "num.too_small",
                &format!("Number {} is less than minimum {}", num, m));
        }
    }
    if let Some(m) = max {
        if num > m {
            add_issue(issues, path, "num.too_large",
                &format!("Number {} exceeds maximum {}", num, m));
        }
    }
}

pub fn validate_bool(value: &Value, path: &[String], issues: &mut Issues) {
    if !value.is_boolean() {
        add_issue(issues, path, "type.mismatch",
            &format!("Expected boolean, got {:?}", value));
    }
}

pub fn validate_literal<T: PartialEq + std::fmt::Debug>(
    value: &Value,
    path: &[String],
    issues: &mut Issues,
    expected: T,
) where Value: PartialEq<T> {
    if value != &expected {
        add_issue(issues, path, "literal.mismatch",
            &format!("Expected {:?}, got {:?}", expected, value));
    }
}

pub fn validate_literal_str(value: &Value, path: &[String], issues: &mut Issues, expected: &str) {
    match value.as_str() {
        Some(s) if s == expected => {}
        _ => {
            add_issue(issues, path, "literal.mismatch",
                &format!("Expected {:?}, got {:?}", expected, value));
        }
    }
}

pub fn validate_literal_i64(value: &Value, path: &[String], issues: &mut Issues, expected: i64) {
    match value.as_i64() {
        Some(n) if n == expected => {}
        _ => {
            add_issue(issues, path, "literal.mismatch",
                &format!("Expected {}, got {:?}", expected, value));
        }
    }
}

pub fn validate_pattern(value: &Value, path: &[String], issues: &mut Issues, pattern: &str) {
    match value.as_str() {
        Some(s) => {
            if let Ok(re) = Regex::new(pattern) {
                if !re.is_match(s) {
                    add_issue(issues, path, "pattern.mismatch",
                        &format!("Value does not match pattern {}", pattern));
                }
            }
        }
        None => {
            add_issue(issues, path, "type.mismatch",
                &format!("Expected string for pattern match, got {:?}", value));
        }
    }
}

// === Structural Validators ===

pub fn validate_object(value: &Value, path: &[String], issues: &mut Issues) -> bool {
    if value.is_object() {
        true
    } else {
        add_issue(issues, path, "type.mismatch",
            &format!("Expected object, got {:?}", value));
        false
    }
}

pub fn validate_field(
    obj: &Value,
    path: &[String],
    issues: &mut Issues,
    key: &str,
    validator: Option<&dyn Fn(&Value, &[String], &mut Issues)>,
    optional: bool,
) {
    if let Some(map) = obj.as_object() {
        match map.get(key) {
            Some(v) => {
                if let Some(f) = validator {
                    let mut new_path = path.to_vec();
                    new_path.push(key.to_string());
                    f(v, &new_path, issues);
                }
            }
            None if !optional => {
                add_issue(issues, path, "field.missing",
                    &format!("Missing required field: {}", key));
            }
            None => {}
        }
    }
}

pub fn validate_list(
    value: &Value,
    path: &[String],
    issues: &mut Issues,
    item_validator: Option<&dyn Fn(&Value, &[String], &mut Issues)>,
    min_items: Option<usize>,
    max_items: Option<usize>,
) {
    match value.as_array() {
        Some(arr) => {
            if let Some(min) = min_items {
                if arr.len() < min {
                    add_issue(issues, path, "list.too_short",
                        &format!("Array length {} is less than minimum {}", arr.len(), min));
                }
            }
            if let Some(max) = max_items {
                if arr.len() > max {
                    add_issue(issues, path, "list.too_long",
                        &format!("Array length {} exceeds maximum {}", arr.len(), max));
                }
            }
            if let Some(iv) = item_validator {
                for (i, item) in arr.iter().enumerate() {
                    let mut new_path = path.to_vec();
                    new_path.push(format!("[{}]", i));
                    iv(item, &new_path, issues);
                }
            }
        }
        None => {
            add_issue(issues, path, "type.mismatch",
                &format!("Expected array, got {:?}", value));
        }
    }
}

pub fn validate_oneof(
    value: &Value,
    path: &[String],
    issues: &mut Issues,
    validators: &[&dyn Fn(&Value, &[String], &mut Issues)],
) {
    for validator in validators {
        let mut test_issues: Issues = vec![];
        validator(value, path, &mut test_issues);
        if test_issues.is_empty() {
            return; // Matched
        }
    }
    add_issue(issues, path, "oneof.no_match",
        "Value does not match any of the options");
}

// === File System Context ===

pub struct FSContext {
    pub base_path: PathBuf,
    pub is_zip: bool,
    zip_entries: HashMap<String, Vec<u8>>,
}

impl FSContext {
    pub fn new(path: &str) -> Result<Self, String> {
        let path_buf = PathBuf::from(path);

        if path_buf.is_dir() {
            Ok(FSContext {
                base_path: path_buf,
                is_zip: false,
                zip_entries: HashMap::new(),
            })
        } else if path_buf.is_file() && (path.ends_with(".zip") || path.ends_with(".asks")) {
            let file = fs::File::open(&path_buf)
                .map_err(|e| format!("Cannot open zip: {}", e))?;
            let mut archive = ZipArchive::new(file)
                .map_err(|e| format!("Invalid zip: {}", e))?;

            let mut entries = HashMap::new();
            for i in 0..archive.len() {
                let mut entry = archive.by_index(i)
                    .map_err(|e| format!("Cannot read zip entry: {}", e))?;
                let name = entry.name().to_string();
                if !entry.is_dir() {
                    let mut data = Vec::new();
                    entry.read_to_end(&mut data)
                        .map_err(|e| format!("Cannot read zip content: {}", e))?;
                    entries.insert(name, data);
                }
            }

            Ok(FSContext {
                base_path: path_buf,
                is_zip: true,
                zip_entries: entries,
            })
        } else {
            Err(format!("Not a valid bundle: {}", path))
        }
    }

    pub fn exists(&self, rel_path: &str) -> bool {
        if self.is_zip {
            self.zip_entries.contains_key(rel_path)
                || self.zip_entries.keys().any(|k| k.starts_with(&format!("{}/", rel_path)))
        } else {
            self.base_path.join(rel_path).exists()
        }
    }

    pub fn is_file(&self, rel_path: &str) -> bool {
        if self.is_zip {
            self.zip_entries.contains_key(rel_path)
        } else {
            self.base_path.join(rel_path).is_file()
        }
    }

    pub fn is_dir(&self, rel_path: &str) -> bool {
        if self.is_zip {
            self.zip_entries.keys().any(|k| k.starts_with(&format!("{}/", rel_path)))
        } else {
            self.base_path.join(rel_path).is_dir()
        }
    }

    pub fn read(&self, rel_path: &str) -> Result<String, String> {
        if self.is_zip {
            self.zip_entries.get(rel_path)
                .ok_or_else(|| format!("File not found: {}", rel_path))
                .and_then(|data| String::from_utf8(data.clone())
                    .map_err(|e| format!("Invalid UTF-8: {}", e)))
        } else {
            fs::read_to_string(self.base_path.join(rel_path))
                .map_err(|e| format!("Cannot read file: {}", e))
        }
    }

    pub fn read_json(&self, rel_path: &str) -> Result<Value, String> {
        let content = self.read(rel_path)?;
        serde_json::from_str(&content)
            .map_err(|e| format!("Invalid JSON: {}", e))
    }

    pub fn basename(&self) -> String {
        self.base_path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_string()
    }
}

// === File System Validators ===

pub fn validate_bundle(
    bundle_path: &str,
    path_list: &[String],
    issues: &mut Issues,
    accept_dir: bool,
    accept_zip: bool,
    zip_ext: Option<&str>,
    name_pattern: Option<&str>,
    content_validator: Option<&dyn Fn(&FSContext, &[String], &mut Issues)>,
) -> Option<FSContext> {
    let path = Path::new(bundle_path);

    if !path.exists() {
        add_issue(issues, path_list, "bundle.not_found",
            &format!("Path not found: {}", bundle_path));
        return None;
    }

    let is_dir = path.is_dir();
    let is_zip = !is_dir && (bundle_path.ends_with(".zip")
        || zip_ext.map(|e| bundle_path.ends_with(&format!(".{}", e))).unwrap_or(false));

    if is_dir && !accept_dir {
        add_issue(issues, path_list, "bundle.type_mismatch", "Directory not accepted");
        return None;
    }
    if is_zip && !accept_zip {
        add_issue(issues, path_list, "bundle.type_mismatch", "Zip file not accepted");
        return None;
    }
    if !is_dir && !is_zip {
        add_issue(issues, path_list, "bundle.invalid",
            &format!("Not a valid bundle: {}", bundle_path));
        return None;
    }

    match FSContext::new(bundle_path) {
        Ok(ctx) => {
            if let Some(pattern) = name_pattern {
                let name = ctx.basename();
                if let Ok(re) = Regex::new(pattern) {
                    if !re.is_match(&name) {
                        add_issue(issues, path_list, "bundle.name_mismatch",
                            &format!("Name '{}' does not match pattern", name));
                    }
                }
            }

            if let Some(cv) = content_validator {
                cv(&ctx, path_list, issues);
            }

            Some(ctx)
        }
        Err(e) => {
            add_issue(issues, path_list, "bundle.open_error", &e);
            None
        }
    }
}

pub fn validate_json_file(
    ctx: &FSContext,
    rel_path: &str,
    path: &[String],
    issues: &mut Issues,
    content_validator: Option<&dyn Fn(&Value, &[String], &mut Issues)>,
) -> Option<Value> {
    let mut file_path = path.to_vec();
    file_path.push(rel_path.to_string());

    if !ctx.exists(rel_path) {
        add_issue(issues, &file_path, "file.not_found",
            &format!("File not found: {}", rel_path));
        return None;
    }

    if !ctx.is_file(rel_path) {
        add_issue(issues, &file_path, "file.not_file",
            &format!("Not a file: {}", rel_path));
        return None;
    }

    match ctx.read_json(rel_path) {
        Ok(content) => {
            if let Some(cv) = content_validator {
                cv(&content, &file_path, issues);
            }
            Some(content)
        }
        Err(e) => {
            add_issue(issues, &file_path, "json.parse_error", &e);
            None
        }
    }
}

pub fn validate_fs_file(
    ctx: &FSContext,
    rel_path: &str,
    path: &[String],
    issues: &mut Issues,
    ext: Option<&str>,
) -> bool {
    let mut file_path = path.to_vec();
    file_path.push(rel_path.to_string());

    if !ctx.exists(rel_path) {
        add_issue(issues, &file_path, "file.not_found",
            &format!("File not found: {}", rel_path));
        return false;
    }

    if !ctx.is_file(rel_path) {
        add_issue(issues, &file_path, "file.not_file",
            &format!("Not a file: {}", rel_path));
        return false;
    }

    if let Some(e) = ext {
        let actual_ext = Path::new(rel_path)
            .extension()
            .and_then(|s| s.to_str())
            .unwrap_or("");
        if actual_ext != e {
            add_issue(issues, &file_path, "file.wrong_ext",
                &format!("Expected .{}, got .{}", e, actual_ext));
            return false;
        }
    }

    true
}

pub fn validate_fs_directory(
    ctx: &FSContext,
    rel_path: &str,
    path: &[String],
    issues: &mut Issues,
) -> bool {
    let mut dir_path = path.to_vec();
    dir_path.push(rel_path.to_string());

    if !ctx.exists(rel_path) {
        add_issue(issues, &dir_path, "dir.not_found",
            &format!("Directory not found: {}", rel_path));
        return false;
    }

    if !ctx.is_dir(rel_path) {
        add_issue(issues, &dir_path, "dir.not_dir",
            &format!("Not a directory: {}", rel_path));
        return false;
    }

    true
}

// === Entry Points ===

pub fn validate(value: &Value, validator: &dyn Fn(&Value, &[String], &mut Issues)) -> ValidationResult {
    let mut issues: Issues = vec![];
    validator(value, &[], &mut issues);
    ValidationResult {
        ok: issues.is_empty(),
        issues,
    }
}

pub fn validate_path(
    bundle_path: &str,
    validator: &dyn Fn(&str, &[String], &mut Issues) -> Option<FSContext>,
) -> ValidationResult {
    let mut issues: Issues = vec![];
    let _ = validator(bundle_path, &[], &mut issues);
    ValidationResult {
        ok: issues.is_empty(),
        issues,
    }
}
