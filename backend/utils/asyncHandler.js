// Wraps an async controller so rejected promises are forwarded to Express error handling.
//
// FIX: previously this fired the promise chain without returning it
// (`Promise.resolve(fn(...)).catch(next);` — no `return`), so the wrapper
// function itself always synchronously resolved to `undefined`. Express
// never uses a route handler's return value, so this had zero effect on
// production behavior — but it meant `await someController(req, res, next)`
// in tests resolved before the controller's actual async work (DB calls,
// etc.) had finished, causing assertions to run against a still-in-flight
// response. Returning the promise fixes that without changing runtime
// behavior at all.
const asyncHandler = (fn) => (req, res, next) => {
  return Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;