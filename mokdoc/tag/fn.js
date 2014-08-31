//标识这是一个function
exports.tag = {
	handler: function(cmd, data, doc){
		doc.status.fn = true;
		return false;
	}
};
