/* MOK-JS v1.0.0 */
if(!this.mok){
	var mok = {}, require = function(undef){
		var m = mok, done = {};
		return function(modname){
			if(done.hasOwnProperty(modname)){
				return done[modname];
			}
			var x = m[modname];
			if(typeof x==='function'){
				done[modname] = function(){}; //jiandan-cubao-di break circular dependency
				var module = {exports:{}};
				x = x(require, module.exports, module);
				x===undef && (x = module.exports);
			}
			m[modname] = null;
			done[modname] = x;
			return x;
		}
	}();
}
