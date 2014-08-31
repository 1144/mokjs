
exports.tag = {
	multiple: false,
	handler: function(cmd, data, doc){
		return cmd.length>1 ? cmd.slice(1).join(' ') + doc.stringify(data) : false;
	}
};
