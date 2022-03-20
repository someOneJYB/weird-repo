### async 和 await 一直都知道是 generator 的变种，但是意识中 await 修饰的  promise 只要状态改变就不会可以获得返回值，但其实 reject 的状态是需要 try catch 包裹的，所以就有了查看编译后的代码的
```js

const f = () => {
    return new Promise((res, rej) => {
            new Promise(() => {
                rej(123)
            })
        }
    )
    // or you can set promise catch, await 就不会走 error
    return new Promise((res, rej) => {
            new Promise(() => {
                rej(123)
            })
        }
    ).catch(err => err)
}
const a = async() => {
    const res = await f();
    // 因为 reject 导致 unhandleReject 也就是说 async 中并不会处理这样的异常，但是可以现在值得思考的是是如何
    // try catch 异步的 error 的呢
    console.log(res)
    // right method
    try {
        const res = await f();
    } catch(err) {
        console.log(err)
    }
}
```
下面就走近编译后的世界探究我们的疑问
- asyncToGenerator 这个部分主要是拿到了 regenerator-runtime 包转化以后的 generator 函数，去执行里面的逻辑
  ```js
  // 核心代码伪代码, 可以看见流程控制都放在了 generator 的 next 和 throw 方法中，所以需要知道 regenertor-runtime 是如何改造 async 和 await 函数的关联到 generator 的流程控制中的。
  function step(fn, type, res, rej, next, thr, ...args) {
    try {
        const v = fn[type](args);
    if(v.done) {
        if(type === 'next') {
            res(v.value)
        } 
    } else {
        Promise.resolve(v.value).then(next, thr)
  }
    } catch(err) {
    rej(err)
  }
  }
  function async(gen) {
    let fn = gen()
    return function() {
        return new Promise((res, rej) => {
            function next(v) {
                step(fn, 'next', res, rej, next, thr, v)
            }
            function thr(v) {
                    step(fn, 'throw', res, rej, next, thr, v)
            } 
            next(undefined)
        })
    } 
  }
  ```
- 探寻异步变同步的改造过程：regenerator-runtime 核心逻辑在 while 循环里， mark 作用主要是原型上构造出 generator，wrap 函数主要作用是继承 GP，GP 在原型上 next throw 等方法会调用 invoke，callee 的 invoke 方法就会被调用，然后打通了 generator 的流程，regenerator 会初始化一个 context 对象用来控制流程，也就是 callee 函数中的 context，context 中 next 和 pre 初始化是 0，
  然后走逻辑 asyncToGenerator 的函数先调用一下函数，会先执行 next(undefined) 此时执行 generator 的 next 方法会调用改写修改 context 对象的状态，同时在 invoke 里面会执行 tryCatch 函数，执行 while(1) 里面的逻辑，为什么异常 try catch 可以捕获到 promise 中的问题，因为 promise 处理中走了 error 逻辑,例子中的 Promise reject 会在 Promise.resolve().then(fufill, reject)中的 reject 捕获到，然后其实是已经有异常了，此时执行 invoke 中的 throw 方法，就会执行抛出异常的方法，generator-runtime 会事先收集有 try catch 的部分用于异常处理，可以看函数 pushTryEntry
  此时判断 try catch 的逻辑，然后如果存在的话 context 的 dispatchException，会根据 try catch 部位来区别对待逻辑，如果没有 try catch 就会直接抛出异常并结束，在 context 对象中 stop 函数中判断 type 类型如果是 throw 就会抛出异常，如果判断被捕获，就会继续执行逻辑，不会立即 stop，继续执行逻辑，只不过 context 传递的参数变成了 undefined
  
- 综上可知：invoke 函数中控制 generator 中的流程，执行 gen.next
  或者 gen.throw 都后会调用 generator-runtime 生成的 while 方法保证按照顺序执行，
  异常处理只要使用 try catch 以后异步的也会被捕获的原因是， promise.then() 中的 onReject 函数，执行的 gen.throw 后会调用 context 对象中的 dispatchException，判断是否处理后续调用 context 对象的 stop 还是流程继续，流程控制对象是 Context 里包含了初始化、获取异常的相关位置参数。
  异常处理： 1、在 invoke 中使用 tryCatch 函数执行 while 逻辑 2、type 为 throw 的时候的异常处理
  
```js

var f = function f() {
    return new Promise(function (res, rej) {
        new Promise(function () {
            rej(123);
        });
    });
};
var f = function f() {
    return new Promise(function (res, rej) {
        new Promise(function () {
            rej(123);
        });
    });
};

var a = /*#__PURE__*/function () {
    var _ref = (0,_babel_runtime_helpers_asyncToGenerator__WEBPACK_IMPORTED_MODULE_0__["default"])( /*#__PURE__*/_babel_runtime_regenerator__WEBPACK_IMPORTED_MODULE_1___default().mark(function _callee() {
        var res;
        return _babel_runtime_regenerator__WEBPACK_IMPORTED_MODULE_1___default().wrap(function _callee$(_context) {
            // 核心代码，依靠语法编译 ast
            while (1) {
                switch (_context.prev = _context.next) {
                    case 0:
                        _context.prev = 0;
                        _context.next = 3;
                        return f();

                    case 3:
                        res = _context.sent;
                        console.log(res);
                        _context.next = 9;
                        break;

                    case 7:
                        _context.prev = 7;
                        _context.t0 = _context["catch"](0);

                    case 9:
                    case "end":
                        return _context.stop();
                }
            }
            // [0, 7] try catch 的包含位置
        }, _callee, null, [[0, 7]]);
    }));

    return function a() {
        return _ref.apply(this, arguments);
    };
}();
})();

  return function a() {
    return _ref.apply(this, arguments);
  };
}();
})();

/******/ })() 
```
### 还是得总结一下
- 使用 generator 作为流程控制，context 对象中的参数用于在 invoke 函数中执行的时候更新参数，传递 { type: "normal", arg: fn.call(obj, arg) } 对象，同时 context 中 method 'next'， 'throw' 方法还有 done 对象管理 generator 函数中的 done，保证执行 while 函数的进行也就是写的逻辑按照顺序执行。当然这一期也要归功于 ast 的编译规则，填坑系列持续更新！
