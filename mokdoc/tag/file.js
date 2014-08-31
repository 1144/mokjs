
exports.tag = {
	handler: function(cmd, data, doc){
		doc.status.t.push(' file ');
		return false;
	}
};
