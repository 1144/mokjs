
exports.tag = {
	handler: function(cmd, data, doc){
		doc.status.t.push(' private ');
		return false;
	}
};
