
exports.tag = {
	multiple: false,
	handler: function(cmd, data, doc){
		return doc.stringify(data);
	}
};
