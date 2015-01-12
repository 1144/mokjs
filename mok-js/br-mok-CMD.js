/* MOK-JS MOKJS.COM */
if (!this.mok) {
	var mok = {}, require = function (undef) {
		var m = mok, done = {};
		return function (id) {
			if (done.hasOwnProperty(id)) {
				return done[id];
			}
			var x = m[id];
			if (typeof x === 'function') {
				done[id] = function () {}; //jiandan-cubao-di break circular dependency
				var module = {exports:{}};
				x = x(require, module.exports, module);
				x===undef && (x = module.exports);
			} else if (x === undef) {
				throw "MOK-JS error: can't find module ["+ id +"]";
			}
			m[id] = null;
			return done[id] = x;
		}
	}();
}
