
//��������ά������Ŀά����֪ʶ��
exports.tag = {
	multiple: false,
	handler: function(cmd, data, doc){
		if(cmd.length>1){
			//-know �൱�ڱ���
			doc.status.know = true; //����know���
			return cmd.slice(1).join(' ') + doc.stringify(data);
			/*doc.db.know.push({
				f: doc.scope.f,
				desc: cmd.slice(1).join(' ') + doc.stringify(data)
			});
			*/
		}
		return false;
	}
};
