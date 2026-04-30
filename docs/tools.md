# Tools

Tools are dispatched only through `ToolExecutor`. Every call passes through `PermissionGate` before execution.

Safety rules include denial for destructive shell commands, approval for writes and git mutations, explicit-file-only git commits, path containment under the project root, and log sanitization for token-like secrets.
