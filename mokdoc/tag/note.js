
exports.tag = {
	multiple: true,
	handler: function(cmd, data, doc){
		return cmd.slice(1).join(' ') + doc.stringify(data);
	}
};
