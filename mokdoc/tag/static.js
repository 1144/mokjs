
exports.tag = {
	handler: function(cmd, data, doc){
		doc.status.t.push(' static ');
		return false;
	}
};
