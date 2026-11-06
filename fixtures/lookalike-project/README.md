# FAKE TEST FIXTURE: never install

This folder is a fake project used to test Sentinel's name-risk engine.

- **Never run `npm install` (or any package manager command) in this folder.** The dependency names are deliberate look-alikes of popular packages (`expres`, `lodahs`, `axois`, `crossenv`, `jset`, `eslnit`). Real packages with these names may exist on the registry and could be malicious.
- Sentinel only reads `package.json` here as plain JSON. Nothing is installed or executed.
- Contains no real secrets and no real malware.
