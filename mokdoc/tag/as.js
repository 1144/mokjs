
exports.tag = {
	handler: function(cmd, data, doc){
		if(cmd.length>1){
			doc.scope.ns = doc.status.as = cmd[1]; //����asͬʱ��ı����������ռ�
		}
		return false;
	}
};
