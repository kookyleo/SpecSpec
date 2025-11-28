// support/engine.mjs
// The generic, domain-agnostic validation engine.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import * as CoreRules from './core-rules.mjs';

// --- Execution Context Classes ---
class PackageExecutionContext {
    constructor(targetPath) {
        this.path = targetPath;
        this.stat = fs.existsSync(targetPath) ? fs.statSync(targetPath) : null;
        this.issues = [];
    }
    addIssue(code, message, details = {}) { this.issues.push({ level: 'error', code, message, ...details }); }
    createFileContext(relativePath) { return new FileExecutionContext(this, relativePath); }
}

class FileExecutionContext {
    constructor(packageContext, relativePath) {
        this.packageContext = packageContext;
        this.filePath = relativePath;
        this.fullPath = path.join(packageContext.path, relativePath);
        this.stat = fs.existsSync(this.fullPath) ? fs.statSync(this.fullPath) : null;
        this._content = null;
        this._json = null;
        this._jsonParsed = false;
    }
    content() { if (this._content === null) { this._content = fs.readFileSync(this.fullPath, 'utf-8'); } return this._content; }
    json() {
        if (!this._jsonParsed) {
            try { this._json = JSON.parse(this.content()); } catch { this._json = null; }
            this._jsonParsed = true;
        }
        return this._json;
    }
    addIssue(code, message) { this.packageContext.addIssue(code, message, { path: this.filePath }); }
}


// --- The Engine ---
export class ValidationEngine {
    constructor() {
        this.ruleFactories = {};
        this.contextStack = [];

        const handler = {
            get: (target, prop) => {
                if (prop in this.ruleFactories.$) { // Access DSL methods like $.Is, $.Has
                    return this.ruleFactories.$[prop];
                }
                const currentContext = this.contextStack[this.contextStack.length - 1]; // Current execution context
                if (currentContext && prop in currentContext) { // Access context properties like $.path
                    const value = currentContext[prop];
                    return typeof value === 'function' ? value.bind(currentContext) : value;
                }
                // Global DSL factories for descriptors and top-level containers
                if (prop in this.ruleFactories && typeof this.ruleFactories[prop] === 'function') {
                    return this.ruleFactories[prop];
                }
            }
        };
        this.proxy$ = new Proxy({}, handler);
        this.sandboxContext = vm.createContext({ $: this.proxy$, console: console });
    }

    registerRules(factories) {
        Object.assign(this.sandboxContext, factories);
        // Store DSL categories for the proxy handler
        if (factories.$) { // Store $.Is, $.Has, $.Contains
            this.ruleFactories.$ = factories.$;
        }
        if (factories.Package) { // Store Package() factory
            this.ruleFactories.Package = factories.Package;
        }
        // Store other top-level factories like Directory(), File(), ZipFile(), Spec()
        for (const key of ['Directory', 'File', 'ZipFile', 'Spec']) {
            if (factories[key]) {
                this.ruleFactories[key] = factories[key];
            }
        }
    }
    
    run(specPath, targetPath) {
        const specCode = fs.readFileSync(specPath, 'utf8');
        let rootAssertion = null; // This will hold the PackageAssertion instance

        // The Spec.js code will directly call Package({...}) which will set rootAssertion
        this.sandboxContext.Package = (opts) => {
            const assertion = new CoreRules.PackageAssertion(opts); // Uses the CoreRules.PackageAssertion class
            rootAssertion = assertion;
            return assertion; // Though not used, consistent with other factories
        };

        try {
            vm.runInNewContext(specCode, this.sandboxContext, { filename: specPath });
        } catch (err) {
            return { ok: false, issues: [{ level: 'error', code: 'spec.crash', message: `Spec file has a syntax error: ${err.message}` }] };
        }

        if (!rootAssertion) {
            return { ok: false, issues: [{ level: 'error', code: 'spec.empty', message: 'Spec file did not define a root assertion (e.g., Package({...})).' }] };
        }

        const packageContext = new PackageExecutionContext(targetPath);
        
        try {
            // Top-level execution starts here. We call executeInContext to bind '$' to packageContext.
            this.executeInContext(packageContext, () => {
                rootAssertion.execute(this, packageContext); // Execute the root PackageAssertion
            });
        } catch (err) {
            packageContext.addIssue('executor.crash', `The validator crashed: ${err.message}`, { stack: err.stack });
        }
        
        return { ok: packageContext.issues.length === 0, issues: packageContext.issues };
    }

    // This method executes a function (like a rulesFunc or withSpec)
    // within the VM sandbox with '$' bound to the provided context.
    executeInContext(context, func) {
        // Push current context onto stack, then set new current context
        this.contextStack.push(context); 
        this.sandboxContext._tempFunc = func; // Temporarily make the func available in sandbox

        // This is where '$' in the sandbox is dynamically bound to the current context.
        // The proxy handler ensures that '$.Is', '$.Has', etc., still work,
        // and '$.path', '$.json()' etc., refer to the 'context'.
        this.proxy$.currentContext = context; // Update the proxy's internal context reference

        const result = vm.runInNewContext('_tempFunc()', this.sandboxContext);
        
        delete this.sandboxContext._tempFunc;
        this.contextStack.pop(); // Restore previous context
        this.proxy$.currentContext = this.contextStack[this.contextStack.length - 1] || null; // Update proxy reference

        return result;
    }
}
