/* run in the browser */
var isBuilding = true;
window.onload = function () {
	isBuilding = false;
};
var db = document.body, de = document.documentElement;
function goingDown() {
	var scrollHeight = Math.max(de.scrollHeight, db.scrollHeight),
		clientHeight = de.clientHeight || db.clientHeight || 0;
	if (scrollHeight>clientHeight) {
		db.scrollTop = de.scrollTop = scrollHeight - clientHeight;
	}
	isBuilding && setTimeout(goingDown, 100);
}
setTimeout(goingDown, 500);
