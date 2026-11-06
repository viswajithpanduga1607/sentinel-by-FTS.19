# FAKE TEST FIXTURE: never install

Demo project for `node src/cli.js check fixtures/demo-project`.

- **Never run `npm install` here.** It would fetch the look-alike `expres` from the registry and run the fake malicious postinstall of `fake-evil-pkg` (`file:../evil-postinstall`).
- `fake-clean-pkg` (`file:../clean-package`) is a harmless control.
- Sentinel only reads these files as text.
