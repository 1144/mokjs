
exports.tag = {
	handler: function(cmd, data, doc){
		if(cmd.length>1){
			doc.scope.ns = doc.status.as = cmd[1]; //所以as同时会改变下文命名空间
		}
		return false;
	}
};
