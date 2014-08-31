/* MOK-JS v1.0.0 */
if(!this.mok){
	var mok = {}, require = function(){
		var m = mok, done = {};
		return function(modname){
			if(done.hasOwnProperty(modname)){
				return done[modname];
			}
			done[modname] = function(){}; //jiandan-cubao-di break circular dependency
			var x = m[modname], module = {exports:{}};
			x(require, module, module.exports);
			m[modname] = null;
			return done[modname] = module.exports;
		}
	}();
	this.global || (global = this);
}
