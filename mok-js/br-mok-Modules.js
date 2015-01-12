/* MOK-JS MOKJS.COM */
if (!this.mok) {
	var mok = {}, require = function (undef) {
		var m = mok, done = {};
		return function (id) {
			if (done.hasOwnProperty(id)) {
				return done[id];
			}
			var x = m[id], module = {id:id, exports:{}};
			if (x === undef) {
				throw "MOK-JS error: can't find module ["+ id +"]";
			}
			done[id] = function () {}; //jiandan-cubao-di break circular dependency
			x(require, module, module.exports);
			m[id] = null;
			return done[id] = module.exports;
		}
	}();
	this.global || (global = this);
}
