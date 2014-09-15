/* MOK-JS v1.1.0 */
if(!this.mok){
	var mok = {}, require = function(undef){
		var m = mok, done = {};
		return function(id){
			if(done.hasOwnProperty(id)){
				return done[id];
			}
			var x = m[id];
			if(typeof x==='function'){
				done[id] = function(){}; //jiandan-cubao-di break circular dependency
				var module = {exports:{}};
				x = x(require, module.exports, module);
				x===undef && (x = module.exports);
			}
			m[id] = null;
			return done[id] = x;
		}
	}();
}
