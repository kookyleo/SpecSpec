# SpecSpec Python Prelude
# Validation primitives - embedded at top of generated validators

from typing import Any, Callable, TypeAlias

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
        import re
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
    import re
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


# === Entry point ===

def validate(value: Any, validator: Validator) -> dict[str, Any]:
    """Run validation and return result."""
    issues: Issues = []
    validator(value, [], issues)
    return {
        "ok": len(issues) == 0,
        "issues": issues
    }
