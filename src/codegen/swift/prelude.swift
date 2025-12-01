// SpecSpec Swift Prelude
// Validation primitives - embedded at top of generated validators

import Foundation

// MARK: - Types

public struct Issue: Codable {
    public let path: String
    public let code: String
    public let message: String
}

public typealias Issues = [Issue]
public typealias Validator = (Any, [String], inout Issues) -> Void

public struct ValidationResult: Codable {
    public let ok: Bool
    public let issues: Issues
}

private func addIssue(_ issues: inout Issues, _ path: [String], _ code: String, _ message: String) {
    issues.append(Issue(path: path.isEmpty ? "(root)" : path.joined(separator: "."), code: code, message: message))
}

// MARK: - Primitive Validators

public func validateStr(_ value: Any, _ path: [String], _ issues: inout Issues,
                        minLength: Int? = nil, maxLength: Int? = nil, pattern: String? = nil) {
    guard let str = value as? String else {
        addIssue(&issues, path, "type.mismatch", "Expected string, got \(type(of: value))")
        return
    }
    if let min = minLength, str.count < min {
        addIssue(&issues, path, "str.too_short", "String length \(str.count) is less than minimum \(min)")
    }
    if let max = maxLength, str.count > max {
        addIssue(&issues, path, "str.too_long", "String length \(str.count) exceeds maximum \(max)")
    }
    if let p = pattern {
        let regex = try? NSRegularExpression(pattern: p)
        let range = NSRange(str.startIndex..., in: str)
        if regex?.firstMatch(in: str, range: range) == nil {
            addIssue(&issues, path, "str.pattern_mismatch", "String does not match pattern \(p)")
        }
    }
}

public func validateNum(_ value: Any, _ path: [String], _ issues: inout Issues,
                        min: Double? = nil, max: Double? = nil, integer: Bool = false) {
    let num: Double
    if let n = value as? Double {
        num = n
    } else if let n = value as? Int {
        num = Double(n)
    } else if let n = value as? NSNumber {
        num = n.doubleValue
    } else {
        addIssue(&issues, path, "type.mismatch", "Expected number, got \(type(of: value))")
        return
    }

    if integer && num != num.rounded() {
        addIssue(&issues, path, "num.not_integer", "Expected integer, got \(num)")
    }
    if let m = min, num < m {
        addIssue(&issues, path, "num.too_small", "Number \(num) is less than minimum \(m)")
    }
    if let m = max, num > m {
        addIssue(&issues, path, "num.too_large", "Number \(num) exceeds maximum \(m)")
    }
}

public func validateBool(_ value: Any, _ path: [String], _ issues: inout Issues) {
    if !(value is Bool) {
        addIssue(&issues, path, "type.mismatch", "Expected boolean, got \(type(of: value))")
    }
}

public func validateLiteral<T: Equatable>(_ value: Any, _ path: [String], _ issues: inout Issues, _ expected: T) {
    guard let actual = value as? T else {
        addIssue(&issues, path, "literal.mismatch", "Expected \(expected), got \(value)")
        return
    }
    if actual != expected {
        addIssue(&issues, path, "literal.mismatch", "Expected \(expected), got \(actual)")
    }
}

public func validatePattern(_ value: Any, _ path: [String], _ issues: inout Issues, _ pattern: String) {
    guard let str = value as? String else {
        addIssue(&issues, path, "type.mismatch", "Expected string for pattern match, got \(type(of: value))")
        return
    }
    let regex = try? NSRegularExpression(pattern: pattern)
    let range = NSRange(str.startIndex..., in: str)
    if regex?.firstMatch(in: str, range: range) == nil {
        addIssue(&issues, path, "pattern.mismatch", "Value does not match pattern \(pattern)")
    }
}

// MARK: - Structural Validators

public func validateObject(_ value: Any, _ path: [String], _ issues: inout Issues) -> Bool {
    if value is [String: Any] {
        return true
    }
    addIssue(&issues, path, "type.mismatch", "Expected object, got \(type(of: value))")
    return false
}

public func validateField(_ obj: Any, _ path: [String], _ issues: inout Issues,
                          _ key: String, validator: Validator? = nil, optional: Bool = false) {
    guard let dict = obj as? [String: Any] else { return }

    if dict[key] == nil {
        if !optional {
            addIssue(&issues, path, "field.missing", "Missing required field: \(key)")
        }
        return
    }

    if let v = validator {
        v(dict[key]!, path + [key], &issues)
    }
}

public func validateList(_ value: Any, _ path: [String], _ issues: inout Issues,
                         itemValidator: Validator? = nil, minItems: Int? = nil, maxItems: Int? = nil) {
    guard let arr = value as? [Any] else {
        addIssue(&issues, path, "type.mismatch", "Expected array, got \(type(of: value))")
        return
    }

    if let min = minItems, arr.count < min {
        addIssue(&issues, path, "list.too_short", "Array length \(arr.count) is less than minimum \(min)")
    }
    if let max = maxItems, arr.count > max {
        addIssue(&issues, path, "list.too_long", "Array length \(arr.count) exceeds maximum \(max)")
    }

    if let iv = itemValidator {
        for (i, item) in arr.enumerated() {
            iv(item, path + ["[\(i)]"], &issues)
        }
    }
}

public func validateOneOf(_ value: Any, _ path: [String], _ issues: inout Issues,
                          _ validators: [Validator]) {
    for validator in validators {
        var testIssues: Issues = []
        validator(value, path, &testIssues)
        if testIssues.isEmpty {
            return // Matched
        }
    }
    addIssue(&issues, path, "oneof.no_match", "Value does not match any of the options")
}

// MARK: - File System Context

public class FSContext {
    public let basePath: String
    public let isZip: Bool
    private var zipEntries: [String: Data] = [:]

    public init(_ path: String) throws {
        self.basePath = path
        var isDir: ObjCBool = false

        if FileManager.default.fileExists(atPath: path, isDirectory: &isDir) {
            if isDir.boolValue {
                self.isZip = false
            } else if path.hasSuffix(".zip") || path.hasSuffix(".asks") {
                self.isZip = true
                try loadZip()
            } else {
                throw NSError(domain: "FSContext", code: 1, userInfo: [NSLocalizedDescriptionKey: "Not a directory or zip: \(path)"])
            }
        } else {
            throw NSError(domain: "FSContext", code: 2, userInfo: [NSLocalizedDescriptionKey: "Path not found: \(path)"])
        }
    }

    private func loadZip() throws {
        // Simple zip reading - in production use a proper zip library
        let data = try Data(contentsOf: URL(fileURLWithPath: basePath))
        // For simplicity, we'll just store raw data and handle basic cases
        // Real implementation should use ZIPFoundation or similar
        zipEntries["__raw__"] = data
    }

    public func exists(_ relPath: String) -> Bool {
        if isZip {
            return zipEntries[relPath] != nil || zipEntries.keys.contains { $0.hasPrefix(relPath + "/") }
        }
        return FileManager.default.fileExists(atPath: (basePath as NSString).appendingPathComponent(relPath))
    }

    public func isFile(_ relPath: String) -> Bool {
        if isZip {
            return zipEntries[relPath] != nil
        }
        var isDir: ObjCBool = false
        let fullPath = (basePath as NSString).appendingPathComponent(relPath)
        return FileManager.default.fileExists(atPath: fullPath, isDirectory: &isDir) && !isDir.boolValue
    }

    public func isDir(_ relPath: String) -> Bool {
        if isZip {
            return zipEntries.keys.contains { $0.hasPrefix(relPath + "/") }
        }
        var isDir: ObjCBool = false
        let fullPath = (basePath as NSString).appendingPathComponent(relPath)
        return FileManager.default.fileExists(atPath: fullPath, isDirectory: &isDir) && isDir.boolValue
    }

    public func read(_ relPath: String) throws -> String {
        if isZip {
            guard let data = zipEntries[relPath] else {
                throw NSError(domain: "FSContext", code: 3, userInfo: [NSLocalizedDescriptionKey: "File not found in zip: \(relPath)"])
            }
            return String(data: data, encoding: .utf8) ?? ""
        }
        let fullPath = (basePath as NSString).appendingPathComponent(relPath)
        return try String(contentsOfFile: fullPath, encoding: .utf8)
    }

    public func readJson(_ relPath: String) throws -> Any {
        let content = try read(relPath)
        guard let data = content.data(using: .utf8) else {
            throw NSError(domain: "FSContext", code: 4, userInfo: [NSLocalizedDescriptionKey: "Invalid UTF-8"])
        }
        return try JSONSerialization.jsonObject(with: data)
    }

    public func basename() -> String {
        var name = (basePath as NSString).lastPathComponent
        if let dotIdx = name.lastIndex(of: ".") {
            name = String(name[..<dotIdx])
        }
        return name
    }
}

public typealias FSValidator = (FSContext, [String], inout Issues) -> Void

// MARK: - File System Validators

public func validateBundle(_ bundlePath: String, _ pathList: [String], _ issues: inout Issues,
                           acceptDir: Bool = true, acceptZip: Bool = false,
                           zipExt: String? = nil, namePattern: String? = nil,
                           contentValidator: FSValidator? = nil) -> FSContext? {
    var isDir: ObjCBool = false
    let exists = FileManager.default.fileExists(atPath: bundlePath, isDirectory: &isDir)

    if !exists {
        addIssue(&issues, pathList, "bundle.not_found", "Path not found: \(bundlePath)")
        return nil
    }

    let isDirectory = isDir.boolValue
    let isZipFile = !isDirectory && (bundlePath.hasSuffix(".zip") || (zipExt != nil && bundlePath.hasSuffix(".\(zipExt!)")))

    if isDirectory && !acceptDir {
        addIssue(&issues, pathList, "bundle.type_mismatch", "Directory not accepted")
        return nil
    }
    if isZipFile && !acceptZip {
        addIssue(&issues, pathList, "bundle.type_mismatch", "Zip file not accepted")
        return nil
    }
    if !isDirectory && !isZipFile {
        addIssue(&issues, pathList, "bundle.invalid", "Not a valid bundle: \(bundlePath)")
        return nil
    }

    do {
        let ctx = try FSContext(bundlePath)

        if let pattern = namePattern {
            let name = ctx.basename()
            let regex = try? NSRegularExpression(pattern: pattern)
            let range = NSRange(name.startIndex..., in: name)
            if regex?.firstMatch(in: name, range: range) == nil {
                addIssue(&issues, pathList, "bundle.name_mismatch", "Name '\(name)' does not match pattern")
            }
        }

        if let cv = contentValidator {
            cv(ctx, pathList, &issues)
        }

        return ctx
    } catch {
        addIssue(&issues, pathList, "bundle.open_error", error.localizedDescription)
        return nil
    }
}

public func validateJsonFile(_ ctx: FSContext, _ relPath: String, _ path: [String], _ issues: inout Issues,
                             contentValidator: Validator? = nil) -> Any? {
    let filePath = path + [relPath]

    if !ctx.exists(relPath) {
        addIssue(&issues, filePath, "file.not_found", "File not found: \(relPath)")
        return nil
    }

    if !ctx.isFile(relPath) {
        addIssue(&issues, filePath, "file.not_file", "Not a file: \(relPath)")
        return nil
    }

    do {
        let content = try ctx.readJson(relPath)
        if let cv = contentValidator {
            cv(content, filePath, &issues)
        }
        return content
    } catch {
        addIssue(&issues, filePath, "json.parse_error", "Invalid JSON: \(error.localizedDescription)")
        return nil
    }
}

public func validateFsFile(_ ctx: FSContext, _ relPath: String, _ path: [String], _ issues: inout Issues,
                           ext: String? = nil) -> Bool {
    let filePath = path + [relPath]

    if !ctx.exists(relPath) {
        addIssue(&issues, filePath, "file.not_found", "File not found: \(relPath)")
        return false
    }

    if !ctx.isFile(relPath) {
        addIssue(&issues, filePath, "file.not_file", "Not a file: \(relPath)")
        return false
    }

    if let e = ext {
        let actualExt = (relPath as NSString).pathExtension
        if actualExt != e {
            addIssue(&issues, filePath, "file.wrong_ext", "Expected .\(e), got .\(actualExt)")
            return false
        }
    }

    return true
}

public func validateFsDirectory(_ ctx: FSContext, _ relPath: String, _ path: [String], _ issues: inout Issues) -> Bool {
    let dirPath = path + [relPath]

    if !ctx.exists(relPath) {
        addIssue(&issues, dirPath, "dir.not_found", "Directory not found: \(relPath)")
        return false
    }

    if !ctx.isDir(relPath) {
        addIssue(&issues, dirPath, "dir.not_dir", "Not a directory: \(relPath)")
        return false
    }

    return true
}

// MARK: - Entry Points

public func validate(_ value: Any, _ validator: Validator) -> ValidationResult {
    var issues: Issues = []
    validator(value, [], &issues)
    return ValidationResult(ok: issues.isEmpty, issues: issues)
}

public func validatePath(_ bundlePath: String,
                         _ validator: @escaping (String, [String], inout Issues) -> FSContext?) -> ValidationResult {
    var issues: Issues = []
    _ = validator(bundlePath, [], &issues)
    return ValidationResult(ok: issues.isEmpty, issues: issues)
}
