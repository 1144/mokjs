
//构建代码维护、项目维护的知识库
exports.tag = {
	multiple: false,
	handler: function(cmd, data, doc){
		if(cmd.length>1){
			//-know 相当于标题
			doc.status.know = true; //打上know标记
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
