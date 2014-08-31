
exports.tag = {
	multiple: true,
	handler: function(cmd, data, doc){
		if(cmd.length>1){
			return cmd.slice(1).join(' ') + doc.stringify(data);
		}
		return false;
	}
};
