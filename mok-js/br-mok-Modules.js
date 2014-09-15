/* MOK-JS v1.1.0 */
if(!this.mok){
	var mok = {}, require = function(){
		var m = mok, done = {};
		return function(id){
			if(done.hasOwnProperty(id)){
				return done[id];
			}
			done[id] = function(){}; //jiandan-cubao-di break circular dependency
			var x = m[id], module = {id:id, exports:{}};
			x(require, module, module.exports);
			m[id] = null;
			return done[id] = module.exports;
		}
	}();
	this.global || (global = this);
}
