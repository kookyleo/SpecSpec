# SpecSpec Python Prelude
# Validation primitives - embedded at top of generated validators

from typing import Any, Callable, TypeAlias
import os
import json
import zipfile
import re

# Type aliases
Issues: TypeAlias = list[dict[str, Any]]
Validator: TypeAlias = Callable[[Any, list[str], Issues], None]


def add_issue(issues: Issues, path: list[str], code: str, message: str) -> None:
    """Add a validation issue."""
    issues.append({"path": ".".join(path) if path else "(root)", "code": code, "message": message})


# === Primitive validators ===

def validate_str(value: Any, path: list[str], issues: Issues,
                 min_length: int | None = None,
                 max_length: int | None = None,
                 pattern: str | None = None) -> None:
    """Validate string value."""
    if not isinstance(value, str):
        add_issue(issues, path, "type.mismatch", f"Expected string, got {type(value).__name__}")
        return
    if min_length is not None and len(value) < min_length:
        add_issue(issues, path, "str.too_short", f"String length {len(value)} is less than minimum {min_length}")
    if max_length is not None and len(value) > max_length:
        add_issue(issues, path, "str.too_long", f"String length {len(value)} exceeds maximum {max_length}")
    if pattern is not None:
        if not re.match(pattern, value):
            add_issue(issues, path, "str.pattern_mismatch", f"String does not match pattern {pattern}")


def validate_num(value: Any, path: list[str], issues: Issues,
                 min_val: float | None = None,
                 max_val: float | None = None,
                 integer: bool = False) -> None:
    """Validate number value."""
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        add_issue(issues, path, "type.mismatch", f"Expected number, got {type(value).__name__}")
        return
    if integer and not isinstance(value, int):
        add_issue(issues, path, "num.not_integer", f"Expected integer, got {value}")
    if min_val is not None and value < min_val:
        add_issue(issues, path, "num.too_small", f"Number {value} is less than minimum {min_val}")
    if max_val is not None and value > max_val:
        add_issue(issues, path, "num.too_large", f"Number {value} exceeds maximum {max_val}")


def validate_bool(value: Any, path: list[str], issues: Issues) -> None:
    """Validate boolean value."""
    if not isinstance(value, bool):
        add_issue(issues, path, "type.mismatch", f"Expected boolean, got {type(value).__name__}")


def validate_literal(value: Any, path: list[str], issues: Issues, expected: Any) -> None:
    """Validate literal value."""
    if value != expected:
        add_issue(issues, path, "literal.mismatch", f"Expected {expected!r}, got {value!r}")


def validate_pattern(value: Any, path: list[str], issues: Issues, pattern: str) -> None:
    """Validate value matches regex pattern."""
    if not isinstance(value, str):
        add_issue(issues, path, "type.mismatch", f"Expected string for pattern match, got {type(value).__name__}")
        return
    if not re.match(pattern, value):
        add_issue(issues, path, "pattern.mismatch", f"Value does not match pattern {pattern}")


# === Structural validators ===

def validate_object(value: Any, path: list[str], issues: Issues) -> bool:
    """Check value is an object (dict). Returns False if not."""
    if not isinstance(value, dict):
        add_issue(issues, path, "type.mismatch", f"Expected object, got {type(value).__name__}")
        return False
    return True


def validate_field(obj: Any, path: list[str], issues: Issues,
                   key: str, validator: Validator | None = None,
                   optional: bool = False) -> None:
    """Validate a field in an object."""
    if not isinstance(obj, dict):
        return  # Parent validation will catch this

    if key not in obj:
        if not optional:
            add_issue(issues, path, "field.missing", f"Missing required field: {key}")
        return

    if validator is not None:
        validator(obj[key], path + [key], issues)


def validate_list(value: Any, path: list[str], issues: Issues,
                  item_validator: Validator | None = None,
                  min_items: int | None = None,
                  max_items: int | None = None) -> None:
    """Validate list/array value."""
    if not isinstance(value, list):
        add_issue(issues, path, "type.mismatch", f"Expected array, got {type(value).__name__}")
        return

    if min_items is not None and len(value) < min_items:
        add_issue(issues, path, "list.too_short", f"Array length {len(value)} is less than minimum {min_items}")
    if max_items is not None and len(value) > max_items:
        add_issue(issues, path, "list.too_long", f"Array length {len(value)} exceeds maximum {max_items}")

    if item_validator is not None:
        for i, item in enumerate(value):
            item_validator(item, path + [f"[{i}]"], issues)


def validate_oneof(value: Any, path: list[str], issues: Issues,
                   validators: list[Validator],
                   descriptions: list[str] | None = None) -> None:
    """Validate value matches one of the validators."""
    for validator in validators:
        test_issues: Issues = []
        validator(value, path, test_issues)
        if not test_issues:
            return  # Matched

    desc = ", ".join(descriptions) if descriptions else "any of the options"
    add_issue(issues, path, "oneof.no_match", f"Value does not match {desc}")


def matches_validator(value: Any, validator: Validator) -> bool:
    """Test if value matches a validator without adding issues."""
    test_issues: Issues = []
    validator(value, [], test_issues)
    return len(test_issues) == 0


# === File system context ===

class FSContext:
    """File system access context - abstracts directory and zip file access."""

    def __init__(self, base_path: str):
        self.base_path = base_path
        self.is_zip = False
        self.zip_file: zipfile.ZipFile | None = None

        if os.path.isdir(base_path):
            self.is_zip = False
        elif os.path.isfile(base_path) and zipfile.is_zipfile(base_path):
            self.is_zip = True
            self.zip_file = zipfile.ZipFile(base_path, 'r')
        else:
            raise ValueError(f"Not a directory or zip file: {base_path}")

    def exists(self, rel_path: str) -> bool:
        """Check if a file or directory exists."""
        if self.is_zip:
            try:
                self.zip_file.getinfo(rel_path)
                return True
            except KeyError:
                # Try with trailing slash for directories
                try:
                    self.zip_file.getinfo(rel_path + '/')
                    return True
                except KeyError:
                    return False
        else:
            return os.path.exists(os.path.join(self.base_path, rel_path))

    def is_file(self, rel_path: str) -> bool:
        """Check if path is a file."""
        if self.is_zip:
            try:
                info = self.zip_file.getinfo(rel_path)
                return not info.is_dir()
            except KeyError:
                return False
        else:
            return os.path.isfile(os.path.join(self.base_path, rel_path))

    def is_dir(self, rel_path: str) -> bool:
        """Check if path is a directory."""
        if self.is_zip:
            try:
                info = self.zip_file.getinfo(rel_path + '/')
                return info.is_dir()
            except KeyError:
                # Check if any files start with this path
                prefix = rel_path + '/'
                return any(name.startswith(prefix) for name in self.zip_file.namelist())
        else:
            return os.path.isdir(os.path.join(self.base_path, rel_path))

    def read(self, rel_path: str) -> str:
        """Read file content as string."""
        if self.is_zip:
            return self.zip_file.read(rel_path).decode('utf-8')
        else:
            with open(os.path.join(self.base_path, rel_path), 'r', encoding='utf-8') as f:
                return f.read()

    def read_json(self, rel_path: str) -> Any:
        """Read and parse JSON file."""
        return json.loads(self.read(rel_path))

    def basename(self) -> str:
        """Get the base name of the bundle (without extension)."""
        name = os.path.basename(self.base_path)
        if '.' in name:
            name = name.rsplit('.', 1)[0]
        return name

    def close(self) -> None:
        """Close resources."""
        if self.zip_file:
            self.zip_file.close()


# === File system validators ===

FSValidator: TypeAlias = Callable[['FSContext', list[str], Issues], None]


def validate_bundle(path: str, path_list: list[str], issues: Issues,
                    accept_dir: bool = True,
                    accept_zip: bool = False,
                    zip_ext: str | None = None,
                    name_pattern: str | None = None,
                    content_validator: FSValidator | None = None) -> FSContext | None:
    """
    Validate a bundle (directory or zip file).
    Returns FSContext if successful, None otherwise.
    """
    is_dir = os.path.isdir(path)
    is_zip = not is_dir and os.path.isfile(path) and zipfile.is_zipfile(path)

    # Check accepted types
    if is_dir and not accept_dir:
        add_issue(issues, path_list, "bundle.type_mismatch", "Directory not accepted")
        return None
    if is_zip and not accept_zip:
        add_issue(issues, path_list, "bundle.type_mismatch", "Zip file not accepted")
        return None
    if not is_dir and not is_zip:
        add_issue(issues, path_list, "bundle.invalid", f"Not a directory or zip file: {path}")
        return None

    # Check zip extension
    if is_zip and zip_ext:
        if not path.endswith(f'.{zip_ext}'):
            add_issue(issues, path_list, "bundle.wrong_ext", f"Expected .{zip_ext} extension")
            return None

    # Create context
    try:
        ctx = FSContext(path)
    except Exception as e:
        add_issue(issues, path_list, "bundle.open_error", str(e))
        return None

    # Validate name pattern
    if name_pattern:
        name = ctx.basename()
        if not re.match(name_pattern, name):
            add_issue(issues, path_list, "bundle.name_mismatch", f"Name '{name}' does not match pattern")

    # Validate content
    if content_validator:
        content_validator(ctx, path_list, issues)

    return ctx


def validate_json_file(ctx: FSContext, rel_path: str, path: list[str], issues: Issues,
                       content_validator: Validator | None = None) -> Any | None:
    """Validate a JSON file within a bundle context."""
    file_path = path + [rel_path]

    if not ctx.exists(rel_path):
        add_issue(issues, file_path, "file.not_found", f"File not found: {rel_path}")
        return None

    if not ctx.is_file(rel_path):
        add_issue(issues, file_path, "file.not_file", f"Not a file: {rel_path}")
        return None

    try:
        content = ctx.read_json(rel_path)
    except json.JSONDecodeError as e:
        add_issue(issues, file_path, "json.parse_error", f"Invalid JSON: {e}")
        return None
    except Exception as e:
        add_issue(issues, file_path, "file.read_error", str(e))
        return None

    if content_validator:
        content_validator(content, file_path, issues)

    return content


def validate_fs_file(ctx: FSContext, rel_path: str, path: list[str], issues: Issues,
                     ext: str | None = None) -> bool:
    """Validate a file exists within a bundle context."""
    file_path = path + [rel_path]

    if not ctx.exists(rel_path):
        add_issue(issues, file_path, "file.not_found", f"File not found: {rel_path}")
        return False

    if not ctx.is_file(rel_path):
        add_issue(issues, file_path, "file.not_file", f"Not a file: {rel_path}")
        return False

    if ext:
        actual_ext = rel_path.rsplit('.', 1)[-1] if '.' in rel_path else ''
        if actual_ext != ext:
            add_issue(issues, file_path, "file.wrong_ext", f"Expected .{ext}, got .{actual_ext}")
            return False

    return True


def validate_fs_directory(ctx: FSContext, rel_path: str, path: list[str], issues: Issues) -> bool:
    """Validate a directory exists within a bundle context."""
    dir_path = path + [rel_path]

    if not ctx.exists(rel_path):
        add_issue(issues, dir_path, "dir.not_found", f"Directory not found: {rel_path}")
        return False

    if not ctx.is_dir(rel_path):
        add_issue(issues, dir_path, "dir.not_dir", f"Not a directory: {rel_path}")
        return False

    return True


# === Entry points ===

def validate(value: Any, validator: Validator) -> dict[str, Any]:
    """Run validation on a value and return result."""
    issues: Issues = []
    validator(value, [], issues)
    return {
        "ok": len(issues) == 0,
        "issues": issues
    }


def validate_path(path: str, validator: Callable[[str, list[str], Issues], FSContext | None]) -> dict[str, Any]:
    """Run validation on a file system path and return result."""
    issues: Issues = []
    ctx = validator(path, [], issues)
    if ctx:
        ctx.close()
    return {
        "ok": len(issues) == 0,
        "issues": issues
    }
