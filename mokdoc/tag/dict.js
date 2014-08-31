
//注释示例
/*--
	-dict -create openLogin 打开登录浮层的位置 //创建一个数据字典表
	-dict openLogin history 从历史记录打开登录浮层
*/
/*--
	-dict openLogin comment 从评论处打开登录浮层
*/

//构建数据字典
exports.tag = {
	multiple: true,
	handler: function(cmd, data, doc){
		if(cmd.length>2){
			var id = cmd[1];
			//创建一个新的字典表
			if(id==='-create'){
				id = cmd[2];
				if(doc.scope.dicted[id]){
					doc.scope.err_list.push('The dictionary ['+id+'] in ['+doc.scope.f+
						'] has been created!');
				}else{
					doc.db.dict_list.push({
						f: doc.scope.f,
						id: id,
						desc: cmd.slice(3).join(' ') + doc.stringify(data)
					});
				}
			}else{
				//向字典表添加数据
				var dc = doc.db.dict_content;
				(dc[id] || (dc[id] = [])).push({
					f: doc.scope.f,
					val: cmd[2],
					desc: cmd.slice(3).join(' ') + doc.stringify(data)
				});
			}
		}
		return false;
	}
};
