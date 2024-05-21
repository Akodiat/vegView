# VegView

A vegetation model viewer for [LPJ-GUESS](https://web.nateko.lu.se/lpj-guess).

Developed by Joakim Bohlin, InfraVis

## Getting started
The application is already live at [akodiat.github.io/vegView/](https://akodiat.github.io/vegView/), so you should only need to click the link and upload your data.

### Running locally
If you want to run the code locally, you need to start a static webserver.
If you have python 3 on your system, navigate the root of the repository and type:
```sh
python -m http.server 8000
```

If you don't want to install python, a full list of alternative oneliners is available here:
[gist.github.com/willurd/5720255](https://gist.github.com/willurd/5720255)

Once the static server is running, go to [localhost:8000](http://localhost:8000)

## Documentation

Code documentation is found at [akodiat.github.io/vegView/docs](https://akodiat.github.io/vegView/docs).

To compile the documentation (and generate the `docs/` directory), call `jsdoc` with the included config in the repository root:
```sh
jsdoc -c jsdocConf.json
```

### API
The VegView API can be accessed through the [web developer console](https://webmasters.stackexchange.com/questions/8525/how-do-i-open-the-javascript-console-in-different-browsers#77337).

All relevant functions and objects are found as members of the `api` object, e.g. `api.camera`, `api.patchManager`, `api.nextYear()`, `api.exportCSV(delimiter)`. More information can be found [in the documentation](https://akodiat.github.io/vegView/docs/Api.html).

See also the Three.js docs: https://threejs.org/docs/, for information on updating the scene.

The code for the API is found in [src/api.js](../main/src/api.js).

### Advanced video export
While having the video export open, you can customise more options through the API:

```js
// Set your own values here if you want. If you don't specify format, framerate, or scaleFactor, the UI values will be used.
let format='webm', framerate, scaleFactor, distance=100, height=50, nOrbits=4
api.exportOrbitingVideo(format, framerate, scaleFactor, distance, height, nOrbits)
```

You can also write your own cameraPathFunction, here specified as an anonymous [arrow function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Arrow_functions). The function below moves the camera in a line from its current position towards the origin.
```js
// Set a constant target at the origin
const target = new THREE.Vector3(0,0,0);

// Start at the current camera position 
const startPos = api.camera.position.clone();

// Call exportVideo with a custom cameraPathFunction
// (and with format='webm', framerate=10, and scaleFactor=1)
api.exportVideo('webm', 10, 1, progress => {
  const position = startPos.clone();
  position.lerp(target, progress);
  return {position, target}  
});
```
The function `cameraPathFunction` needs to takes a trajectory `progress` parameter, normalised between `0` and `1`, and returning an object with a position and a target vector:
```js
{
  position: THREE.Vector3,
  target: THREE.Vector3
}
```
