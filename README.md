# Launch SDK

This repo is provided for open collaboration on the Launch SDK. No support or guarantess are provided for this SDK or code, but you can fork or open issues to discuss problems or improvements.


## Origins

Based heavily on [webxr-polyfill](https://github.com/immersive-web/webxr-polyfill)

and 

Mozilla's [WebXR iOS](https://github.com/mozilla-mobile/webxr-ios/tree/master?tab=readme-ov-file)

and

Mozilla's [Firefox iOS](https://github.com/mozilla-mobile/firefox-ios)

## License
This project contains code from the above projects, which are licensed under the following licenses:

- [Mozilla Public License Version 2.0](https://www.mozilla.org/en-US/MPL/2.0/)

- [Apache License Version 2.0](https://www.apache.org/licenses/LICENSE-2.0)

For simplicity, this project is licensed as a whole under the Mozilla Public License Version 2.0. (both pre-existing and Launch-specific code) If this causes complications for you, open an issue and we can discuss alternatives.

## Local Dev

run npm run serve / npm run serve-threejs

pass `VLaunch.init({environment: ENV})` to use local dev sdk across environments
