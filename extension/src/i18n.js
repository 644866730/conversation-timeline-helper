/* Bundled, offline interface translations. User conversation text is never translated. */
(function (root) {
  'use strict';
  const LANGUAGES = Object.freeze([
    {value:'zh-CN',label:'简体中文'}, {value:'zh-TW',label:'繁體中文'},
    {value:'en',label:'English'}, {value:'ja',label:'日本語'},
    {value:'ko',label:'한국어'}, {value:'es',label:'Español'},
    {value:'fr',label:'Français'}, {value:'de',label:'Deutsch'}
  ].map(entry => Object.freeze(entry)));
  const catalogs = Object.create(null), forbidden = new Set(['__proto__','constructor','prototype']);
  for (const {value} of LANGUAGES) catalogs[value] = Object.create(null);
  function match(value) {
    if (typeof value !== 'string') return null;
    const parts = value.replace(/_/g,'-').toLowerCase().split('-'), base = parts[0];
    if (base === 'zh') {
      const script = parts.find(part => part === 'hans' || part === 'hant');
      if (script) return script === 'hant' ? 'zh-TW' : 'zh-CN';
      return parts.some(part => ['tw','hk','mo'].includes(part)) ? 'zh-TW' : 'zh-CN';
    }
    return ['en','ja','ko','es','fr','de'].includes(base) ? base : null;
  }
  function browserLanguages() {
    const nav = root.navigator;
    return nav?.languages?.length ? nav.languages : nav?.language ? [nav.language] : ['en'];
  }
  function resolve(language = 'auto', preferred = browserLanguages()) {
    if (language !== 'auto') return match(language) || 'en';
    const candidates = Array.isArray(preferred) ? preferred : [preferred];
    for (const candidate of candidates) { const locale = match(candidate); if (locale) return locale; }
    return 'en';
  }
  function register(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return;
    // Only own data properties are accepted; getters and prototype pollution are ignored.
    for (const locale of Object.keys(catalogs)) {
      const entry = Object.getOwnPropertyDescriptor(input,locale);
      const source = entry?.value;
      if (!source || typeof source !== 'object' || Array.isArray(source)) continue;
      for (const key of Object.keys(source)) {
        const descriptor = Object.getOwnPropertyDescriptor(source,key);
        if (!forbidden.has(key) && typeof descriptor?.value === 'string') catalogs[locale][key] = descriptor.value;
      }
    }
  }
  function t(key, values = {}, language = 'auto') {
    const id = String(key), locale = resolve(language);
    const template = catalogs[locale][id] ?? catalogs['zh-CN'][id] ?? id;
    return template.replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g,(token,name) => {
      if (!values || (typeof values !== 'object' && typeof values !== 'function')) return token;
      const descriptor = Object.getOwnPropertyDescriptor(values,name);
      return descriptor && 'value' in descriptor && descriptor.value !== null && descriptor.value !== undefined ? String(descriptor.value) : token;
    });
  }
  // Columns: Simplified Chinese key, English, Traditional Chinese, Japanese,
  // Korean, Spanish, French, German. Each locale is complete for these keys.
  const rows = [
    ['打开消息目录 · Alt+Shift+T','Open outline · Alt+Shift+T','開啟訊息目錄 · Alt+Shift+T','目次を開く · Alt+Shift+T','목차 열기 · Alt+Shift+T','Abrir índice · Alt+Shift+T','Ouvrir le sommaire · Alt+Shift+T','Übersicht öffnen · Alt+Shift+T'],
    ['收起消息目录 · Alt+Shift+T','Close outline · Alt+Shift+T','收合訊息目錄 · Alt+Shift+T','目次を閉じる · Alt+Shift+T','목차 닫기 · Alt+Shift+T','Cerrar índice · Alt+Shift+T','Fermer le sommaire · Alt+Shift+T','Übersicht schließen · Alt+Shift+T'],
    ['目录','Index','目錄','目次','목차','Índice','Plan','Index'],
    ['{site} 对话时间轴','{site} conversation timeline','{site} 對話時間軸','{site} の会話タイムライン','{site} 대화 타임라인','Cronología de {site}','Chronologie {site}','{site}-Gesprächsverlauf'],
    ['消息目录','Message outline','訊息目錄','メッセージ目次','메시지 목차','Índice de mensajes','Sommaire des messages','Nachrichtenübersicht'],
    ['对话导航','Conversation navigator','對話導覽','会話ナビゲーター','대화 탐색','Navegar conversación','Navigation de conversation','Gesprächsnavigation'],
    ['把长对话，变成清晰的路径。','Find your way through long conversations.','讓長對話，變成清楚的路徑。','長い会話を、わかりやすく。','긴 대화를 쉽게 탐색하세요.','Encuentra tu camino en conversaciones largas.','Retrouvez votre chemin dans les longues conversations.','Lange Gespräche übersichtlich erkunden.'],
    ['收起目录 · Esc','Close outline · Esc','收合目錄 · Esc','目次を閉じる · Esc','목차 닫기 · Esc','Cerrar índice · Esc','Fermer le sommaire · Esc','Übersicht schließen · Esc'],
    ['搜索已加载消息或序号…','Search loaded messages or numbers…','搜尋已載入訊息或序號…','読み込み済みのメッセージや番号を検索…','불러온 메시지 또는 번호 검색…','Buscar mensajes cargados o números…','Rechercher les messages chargés ou un numéro…','Geladene Nachrichten oder Nummern suchen…'],
    ['搜索本页已加载过的消息','Search messages loaded on this page','搜尋本頁已載入過的訊息','このページで読み込んだメッセージを検索','이 페이지에서 불러온 메시지 검색','Buscar mensajes cargados en esta página','Rechercher les messages chargés sur cette page','Auf dieser Seite geladene Nachrichten durchsuchen'],
    ['清空搜索','Clear search','清除搜尋','検索をクリア','검색 지우기','Borrar búsqueda','Effacer la recherche','Suche löschen'],
    ['显示消息范围','Message scope','顯示訊息範圍','表示するメッセージ','메시지 표시 범위','Mensajes visibles','Messages affichés','Nachrichtenbereich'],
    ['只看我的提问','My prompts','只看我的提問','自分の質問のみ','내 질문만','Mis preguntas','Mes questions','Meine Fragen'],
    ['提问与回复','Prompts and replies','提問與回覆','質問と回答','질문 및 답변','Preguntas y respuestas','Questions et réponses','Fragen und Antworten'],
    ['仅看收藏','Show bookmarks only','只看收藏','ブックマークのみ表示','북마크만 표시','Solo marcadores','Afficher les favoris','Nur Lesezeichen anzeigen'],
    ['收藏','Bookmarks','收藏','保存','북마크','Guardados','Favoris','Lesezeichen'],
    ['{count} 条','{count} messages','{count} 則','{count} 件','{count}개','{count} mensajes','{count} messages','{count} Nachrichten'],
    ['当前消息','Current messages','目前訊息','現在のメッセージ','현재 메시지','Mensajes actuales','Messages actuels','Aktuelle Nachrichten'],
    ['密集节点精确选择','Choose crowded markers precisely','密集節點精確選取','密集したマーカーを選択','밀집된 노드 정밀 선택','Elegir marcadores agrupados','Choisir les repères rapprochés','Dichte Markierungen gezielt auswählen'],
    ['前一组附近消息','Previous nearby messages','上一組附近訊息','近くのメッセージ：前へ','이전 주변 메시지','Grupo cercano anterior','Messages voisins précédents','Vorherige benachbarte Nachrichten'],
    ['后一组附近消息','Next nearby messages','下一組附近訊息','近くのメッセージ：次へ','다음 주변 메시지','Grupo cercano siguiente','Messages voisins suivants','Nächste benachbarte Nachrichten'],
    ['退出附近消息，恢复当前显示范围','Leave nearby messages and restore the current scope','退出附近訊息，恢復目前顯示範圍','周辺表示を終了して元の範囲に戻る','주변 메시지 표시를 종료하고 이전 범위 복원','Salir de cercanos y restaurar el alcance','Quitter les voisins et rétablir la portée','Nachbarschaft verlassen und Bereich wiederherstellen'],
    ['退出附近','Show all','退出附近','周辺表示を終了','주변 표시 종료','Ver todos','Tout afficher','Alle anzeigen'],
    ['返回刚才的阅读位置','Return to your previous reading position','返回剛才的閱讀位置','前の閲覧位置に戻る','이전 읽기 위치로 돌아가기','Volver a la posición de lectura anterior','Revenir à la position de lecture précédente','Zur vorherigen Lesestelle zurückkehren'],
    ['返回阅读处','Back to reading','返回閱讀處','閲覧位置に戻る','읽던 곳으로','Volver a leer','Revenir à la lecture','Zur Lesestelle'],
    ['当前已加载内容','Currently loaded content','目前已載入內容','読み込み済みの内容','현재 불러온 내용','Contenido cargado','Contenu chargé','Geladene Inhalte'],
    ['跳到第一条消息','Go to first message','跳至第一則訊息','最初のメッセージへ','첫 메시지로','Ir al primer mensaje','Aller au premier message','Zur ersten Nachricht'],
    ['首条','First','首則','最初','처음','Primero','Premier','Anfang'],
    ['跳到最后一条消息','Go to last message','跳至最後一則訊息','最後のメッセージへ','마지막 메시지로','Ir al último mensaje','Aller au dernier message','Zur letzten Nachricht'],
    ['末条','Last','末則','最後','마지막','Último','Dernier','Ende'],
    ['识别状态与快捷键','Detection status and shortcuts','辨識狀態與快捷鍵','認識状態とショートカット','인식 상태 및 단축키','Detección y atajos','Détection et raccourcis','Erkennung und Tastenkürzel'],
    ['重新识别当前页面','Rescan current page','重新辨識目前頁面','現在のページを再検出','현재 페이지 다시 인식','Volver a detectar esta página','Analyser à nouveau cette page','Aktuelle Seite neu erkennen'],
    ['重新识别','Rescan','重新辨識','再検出','다시 인식','Detectar','Analyser','Neu erkennen'],
    ['导出当前列表为 Markdown','Export current list as Markdown','將目前清單匯出為 Markdown','現在の一覧を Markdown で出力','현재 목록을 Markdown으로 내보내기','Exportar lista actual a Markdown','Exporter la liste en Markdown','Aktuelle Liste als Markdown exportieren'],
    ['导出','Export','匯出','出力','내보내기','Exportar','Exporter','Exportieren'],
    ['仅已加载消息 · 点击节点才自动翻页定位','Loaded messages only · Select a marker to locate older messages','僅已載入訊息 · 點選節點才自動翻頁定位','読み込み済みのみ · マーカー選択時にページを移動','불러온 메시지만 · 노드 선택 시 이전 메시지 탐색','Solo mensajes cargados · Selecciona un marcador para localizar','Messages chargés uniquement · Sélectionnez un repère pour naviguer','Nur geladene Nachrichten · Markierung zur Suche auswählen'],
    ['随页面加载自动更新','Updates as the page loads','隨頁面載入自動更新','ページの読み込みに合わせて更新','페이지 로딩에 맞춰 업데이트','Se actualiza al cargar la página','Mise à jour au chargement de la page','Aktualisiert sich beim Laden der Seite'],
    ['取消定位','Cancel navigation','取消定位','移動をキャンセル','이동 취소','Cancelar navegación','Annuler la navigation','Navigation abbrechen'],
    ['取消','Cancel','取消','キャンセル','취소','Cancelar','Annuler','Abbrechen'],
    ['重试网页定位','Retry locating the message','重試網頁定位','メッセージへの移動を再試行','메시지 위치 찾기 다시 시도','Reintentar localizar el mensaje','Réessayer de localiser le message','Nachricht erneut suchen'],
    ['重试','Retry','重試','再試行','다시 시도','Reintentar','Réessayer','Erneut versuchen'],
    ['初始化','Initializing','初始化','初期化中','초기화 중','Iniciando','Initialisation','Initialisierung'],
    ['关闭','Close','關閉','閉じる','닫기','Cerrar','Fermer','Schließen'],
    ['关闭提示','Dismiss notice','關閉提示','通知を閉じる','알림 닫기','Cerrar aviso','Fermer la notification','Hinweis schließen'],
    ['网页暂未恢复目标消息，请重试。','The page has not restored this message. Please retry.','網頁尚未還原目標訊息，請重試。','ページで対象のメッセージを復元できませんでした。再試行してください。','페이지에서 메시지를 복원하지 못했습니다. 다시 시도하세요.','La página aún no ha restaurado el mensaje. Reinténtalo.','La page n’a pas restauré ce message. Réessayez.','Die Seite hat die Nachricht noch nicht wiederhergestellt. Bitte erneut versuchen.'],
    ['正在定位{name}…{paging}','Locating {name}…{paging}','正在定位{name}…{paging}','{name}へ移動中…{paging}','{name} 찾는 중…{paging}','Localizando {name}…{paging}','Localisation de {name}…{paging}','{name} wird gesucht…{paging}'],
    [' 自动换页中',' Loading pages',' 正在自動翻頁',' ページを読み込み中',' 페이지 로딩 중',' Cargando páginas',' Chargement des pages',' Seiten werden geladen'],
    ['已加载过 {count} 条 · 网页当前挂载 {mounted} 条','{count} observed · {mounted} currently on page','已載入過 {count} 則 · 網頁目前掛載 {mounted} 則','読込済み {count} 件 · ページ内 {mounted} 件','불러온 메시지 {count}개 · 현재 페이지 {mounted}개','{count} cargados · {mounted} presentes en la página','{count} chargés · {mounted} présents sur la page','{count} erfasst · {mounted} aktuell auf der Seite'],
    ['已加载 {count} 条消息 · 仅当前对话','{count} loaded messages · Current chat only','已載入 {count} 則訊息 · 僅目前對話','{count} 件読み込み済み · 現在の会話のみ','메시지 {count}개 불러옴 · 현재 대화만','{count} mensajes cargados · Solo este chat','{count} messages chargés · Conversation actuelle','{count} Nachrichten geladen · Nur dieser Chat'],
    ['不自动补全历史 · 点击旧节点，自动换页定位','No background history loading · Select older markers to locate','不自動補齊歷史 · 點選舊節點才翻頁定位','履歴は自動取得しません · 過去のマーカーを選んで移動','기록 자동 로딩 안 함 · 이전 노드를 선택해 이동','Sin carga de historial en segundo plano · Selecciona para localizar','Pas de chargement automatique de l’historique · Cliquez pour naviguer','Kein automatisches Nachladen · Alte Markierungen zur Suche auswählen'],
    ['设置保存失败；扩展更新后请刷新此页面。','Could not save settings. Refresh this page after updating the extension.','設定儲存失敗；擴充功能更新後請重新整理此頁。','設定を保存できません。拡張機能の更新後はページを再読み込みしてください。','설정을 저장하지 못했습니다. 확장 프로그램 업데이트 후 페이지를 새로고침하세요.','No se guardó la configuración. Recarga la página tras actualizar la extensión.','Impossible d’enregistrer les réglages. Actualisez la page après la mise à jour.','Einstellungen konnten nicht gespeichert werden. Seite nach dem Update neu laden.'],
    ['提问 {number}','Prompt {number}','提問 {number}','質問 {number}','질문 {number}','Pregunta {number}','Question {number}','Frage {number}'],
    ['回复 {number}','Reply {number}','回覆 {number}','回答 {number}','답변 {number}','Respuesta {number}','Réponse {number}','Antwort {number}'],
    ['提问','Prompt','提問','質問','질문','Pregunta','Question','Frage'],
    ['回复','Reply','回覆','回答','답변','Respuesta','Réponse','Antwort'],
    ['已取消临时收藏','Temporary bookmark removed','已取消暫存收藏','一時ブックマークを削除しました','임시 북마크를 해제했습니다','Marcador temporal eliminado','Favori temporaire supprimé','Temporäres Lesezeichen entfernt'],
    ['当前会话没有稳定编号，收藏仅在本页有效。','This chat has no stable ID. Bookmarks last only while this page is open.','目前對話沒有穩定編號，收藏僅於本頁有效。','会話に固定 ID がありません。ブックマークはこのページでのみ有効です。','고정 대화 ID가 없어 북마크는 이 페이지에서만 유지됩니다.','Este chat no tiene ID estable. Los marcadores solo duran en esta página.','Cette conversation n’a pas d’identifiant stable. Les favoris sont temporaires.','Dieser Chat hat keine feste ID. Lesezeichen gelten nur auf dieser Seite.'],
    ['已取消收藏','Bookmark removed','已取消收藏','ブックマークを削除しました','북마크를 해제했습니다','Marcador eliminado','Favori supprimé','Lesezeichen entfernt'],
    ['已收藏，保存在此浏览器','Bookmarked in this browser','已收藏，儲存於此瀏覽器','このブラウザーに保存しました','이 브라우저에 북마크를 저장했습니다','Marcador guardado en este navegador','Favori enregistré dans ce navigateur','Lesezeichen in diesem Browser gespeichert'],
    ['收藏保存失败：请刷新页面，或检查扩展存储是否已满。','Could not save bookmark. Refresh the page or check extension storage.','收藏儲存失敗：請重新整理頁面，或檢查擴充功能儲存空間。','保存できませんでした。ページを再読み込みするか、拡張機能の保存領域を確認してください。','북마크를 저장하지 못했습니다. 새로고침하거나 저장 공간을 확인하세요.','No se guardó el marcador. Recarga la página o revisa el almacenamiento.','Impossible d’enregistrer le favori. Actualisez la page ou vérifiez le stockage.','Lesezeichen nicht gespeichert. Seite neu laden oder Erweiterungsspeicher prüfen.'],
    ['页面识别失败：{error}','Page detection failed: {error}','頁面辨識失敗：{error}','ページの認識に失敗しました：{error}','페이지 인식 실패: {error}','Error de detección: {error}','Échec de détection : {error}','Seitenerkennung fehlgeschlagen: {error}'],
    ['识别器：{adapter}','Adapter: {adapter}','辨識器：{adapter}','アダプター：{adapter}','어댑터: {adapter}','Adaptador: {adapter}','Adaptateur : {adapter}','Adapter: {adapter}'],
    ['{users} 条提问 / {assistants} 条回复','{users} prompts / {assistants} replies','{users} 則提問 / {assistants} 則回覆','質問 {users} 件 / 回答 {assistants} 件','질문 {users}개 / 답변 {assistants}개','{users} preguntas / {assistants} respuestas','{users} questions / {assistants} réponses','{users} Fragen / {assistants} Antworten'],
    ['页面挂载：{count} 条','On page: {count} messages','頁面掛載：{count} 則','ページ内：{count} 件','페이지에 표시됨: {count}개','En la página: {count} mensajes','Sur la page : {count} messages','Auf der Seite: {count} Nachrichten'],
    ['收藏：此浏览器本地保存','Bookmarks: saved locally in this browser','收藏：儲存於此瀏覽器本機','ブックマーク：このブラウザー内に保存','북마크: 이 브라우저에 로컬 저장','Marcadores: guardados en este navegador','Favoris : stockés dans ce navigateur','Lesezeichen: lokal in diesem Browser'],
    ['收藏：临时会话，仅本页有效','Bookmarks: temporary, current page only','收藏：暫存對話，僅本頁有效','ブックマーク：一時保存、このページのみ','북마크: 임시 대화, 현재 페이지만','Marcadores: temporales, solo esta página','Favoris : temporaires, sur cette page uniquement','Lesezeichen: temporär, nur diese Seite'],
    ['Alt+Shift+T：展开/收起目录','Alt+Shift+T: open/close outline','Alt+Shift+T：展開／收合目錄','Alt+Shift+T：目次を開く／閉じる','Alt+Shift+T: 목차 열기/닫기','Alt+Shift+T: abrir/cerrar índice','Alt+Shift+T : ouvrir/fermer le sommaire','Alt+Shift+T: Übersicht öffnen/schließen'],
    ['Alt+Shift+↑ / ↓：上一条/下一条','Alt+Shift+↑ / ↓: previous/next message','Alt+Shift+↑ / ↓：上一則／下一則','Alt+Shift+↑ / ↓：前／次のメッセージ','Alt+Shift+↑ / ↓: 이전/다음 메시지','Alt+Shift+↑ / ↓: mensaje anterior/siguiente','Alt+Shift+↑ / ↓ : message précédent/suivant','Alt+Shift+↑ / ↓: vorherige/nächste Nachricht'],
    ['更多设置：浏览器工具栏的扩展图标','More settings: extension icon in the browser toolbar','更多設定：瀏覽器工具列的擴充功能圖示','その他の設定：ブラウザーの拡張機能アイコン','추가 설정: 브라우저 도구 모음의 확장 아이콘','Más opciones: icono de la extensión en el navegador','Autres réglages : icône de l’extension dans le navigateur','Weitere Einstellungen: Erweiterungssymbol im Browser'],
    ['附近 {start}–{end} / {total}','Nearby {start}–{end} / {total}','附近 {start}–{end} / {total}','周辺 {start}–{end} / {total}','주변 {start}–{end} / {total}','Cercanos {start}–{end} / {total}','Voisins {start}–{end} / {total}','Benachbart {start}–{end} / {total}'],
    ['{users} 条提问 · {assistants} 条回复','{users} prompts · {assistants} replies','{users} 則提問 · {assistants} 則回覆','質問 {users} 件 · 回答 {assistants} 件','질문 {users}개 · 답변 {assistants}개','{users} preguntas · {assistants} respuestas','{users} questions · {assistants} réponses','{users} Fragen · {assistants} Antworten'],
    ['导出当前列表的 {count} 条已加载消息为 Markdown','Export these {count} loaded messages as Markdown','將目前清單的 {count} 則已載入訊息匯出為 Markdown','一覧の {count} 件を Markdown で出力','현재 목록의 메시지 {count}개를 Markdown으로 내보내기','Exportar estos {count} mensajes cargados a Markdown','Exporter ces {count} messages chargés en Markdown','Diese {count} geladenen Nachrichten als Markdown exportieren'],
    ['展开或收起{name}的章节目录','Expand or collapse sections in {name}','展開或收合{name}的章節目錄','{name}の見出しを展開／折りたたむ','{name}의 목차 펼치기/접기','Expandir o contraer secciones de {name}','Développer ou réduire les sections de {name}','Abschnitte von {name} ein-/ausklappen'],
    ['查看章节 · {count}','Sections · {count}','查看章節 · {count}','見出し · {count}','목차 · {count}','Secciones · {count}','Sections · {count}','Abschnitte · {count}'],
    ['收起章节 · {count}','Hide sections · {count}','收合章節 · {count}','見出しを閉じる · {count}','목차 접기 · {count}','Ocultar secciones · {count}','Masquer les sections · {count}','Abschnitte schließen · {count}'],
    ['{name}的章节','Sections in {name}','{name}的章節','{name}の見出し','{name}의 목차','Secciones de {name}','Sections de {name}','Abschnitte von {name}'],
    ['取消收藏','Remove bookmark','取消收藏','ブックマークを解除','북마크 해제','Quitar marcador','Retirer des favoris','Lesezeichen entfernen'],
    ['收藏这条消息','Bookmark this message','收藏這則訊息','このメッセージを保存','이 메시지 북마크','Guardar este mensaje','Ajouter ce message aux favoris','Diese Nachricht als Lesezeichen speichern'],
    ['没有符合条件的消息','No matching messages','沒有符合條件的訊息','一致するメッセージがありません','일치하는 메시지가 없습니다','No hay mensajes coincidentes','Aucun message correspondant','Keine passenden Nachrichten'],
    ['还没有识别到消息','No messages detected yet','尚未辨識到訊息','メッセージはまだ検出されていません','아직 메시지를 찾지 못했습니다','Aún no se detectan mensajes','Aucun message détecté pour le moment','Noch keine Nachrichten erkannt'],
    ['试试更短的关键词、切换范围，或关闭收藏筛选。','Try a shorter search, change the scope, or turn off the bookmark filter.','試試較短的關鍵字、切換範圍，或關閉收藏篩選。','短いキーワード、表示範囲の変更、ブックマーク絞り込みの解除をお試しください。','검색어를 줄이거나 범위를 바꾸고 북마크 필터를 해제해 보세요.','Prueba una búsqueda más corta, cambia el alcance o quita el filtro de marcadores.','Essayez des mots plus courts, changez la portée ou désactivez le filtre des favoris.','Kürzeren Suchbegriff, anderen Bereich oder ohne Lesezeichenfilter versuchen.'],
    ['请打开一段对话。内容已显示但这里仍为空时，可重新识别，或在扩展设置中查看诊断、配置备用选择器。','Open a conversation. If messages are visible but this list is empty, rescan or check diagnostics and fallback selectors in settings.','請開啟一段對話。若訊息已顯示但清單仍空白，請重新辨識，或在設定中查看診斷與備用選擇器。','会話を開いてください。表示済みのメッセージが見つからない場合は、再検出するか設定で診断と予備セレクターを確認してください。','대화를 여세요. 메시지가 보이는데 목록이 비어 있으면 다시 인식하거나 설정에서 진단과 대체 선택자를 확인하세요.','Abre una conversación. Si ves mensajes pero la lista está vacía, vuelve a detectar o revisa los diagnósticos y selectores alternativos en ajustes.','Ouvrez une conversation. Si des messages sont visibles mais la liste est vide, relancez l’analyse ou vérifiez les diagnostics et sélecteurs dans les réglages.','Gespräch öffnen. Sind Nachrichten sichtbar, aber die Liste leer, neu erkennen oder Diagnose und Ersatzselektoren in den Einstellungen prüfen.'],
    ['第 {current} / {total} 条 · 已加载','{current} / {total} · Loaded','第 {current} / {total} 則 · 已載入','{current} / {total} 件 · 読込済み','{current} / {total} · 불러옴','{current} / {total} · Cargados','{current} / {total} · Chargés','{current} / {total} · Geladen'],
    ['会话正在切换，请稍后重新选择。','The conversation is changing. Please select again shortly.','對話正在切換，請稍後重新選取。','会話を切り替え中です。少し待って再度選択してください。','대화 전환 중입니다. 잠시 후 다시 선택하세요.','La conversación está cambiando. Vuelve a seleccionar en un momento.','La conversation change. Réessayez dans un instant.','Das Gespräch wird gewechselt. Bitte gleich erneut auswählen.'],
    ['已返回刚才的阅读位置','Returned to your reading position','已返回剛才的閱讀位置','前の閲覧位置に戻りました','이전 읽기 위치로 돌아왔습니다','Has vuelto a la posición de lectura anterior','Retour à la position de lecture précédente','Zur vorherigen Lesestelle zurückgekehrt'],
    ['已定位章节：{title}','Section found: {title}','已定位章節：{title}','見出しに移動しました：{title}','목차로 이동: {title}','Sección localizada: {title}','Section trouvée : {title}','Abschnitt gefunden: {title}'],
    ['章节已变化，已定位到所在回复。','The section changed. Moved to its reply instead.','章節已變更，已定位至所在回覆。','見出しが変わったため、該当する回答に移動しました。','목차가 변경되어 해당 답변으로 이동했습니다.','La sección ha cambiado. Se ha abierto la respuesta.','La section a changé. La réponse correspondante est affichée.','Der Abschnitt wurde geändert. Zugehörige Antwort geöffnet.'],
    ['已定位到{name}','Moved to {name}','已定位至{name}','{name}に移動しました','{name}(으)로 이동했습니다','Se ha abierto {name}','Navigation vers {name}','Zu {name} gewechselt'],
    ['本条正文缓存已截断。','The cached body of this message was truncated.','本則正文快取已截斷。','このメッセージのキャッシュ本文は省略されています。','이 메시지의 캐시 본문이 잘렸습니다.','La caché de este mensaje está truncada.','Le texte mis en cache de ce message est tronqué.','Der zwischengespeicherte Nachrichtentext wurde gekürzt.'],
    ['附近消息','Nearby messages','附近訊息','周辺のメッセージ','주변 메시지','Mensajes cercanos','Messages voisins','Benachbarte Nachrichten'],
    ['收藏列表','Bookmark list','收藏清單','ブックマーク一覧','북마크 목록','Lista de marcadores','Liste des favoris','Lesezeichenliste'],
    ['搜索结果','Search results','搜尋結果','検索結果','검색 결과','Resultados de búsqueda','Résultats de recherche','Suchergebnisse'],
    ['当前显示列表','Current list','目前顯示清單','現在の一覧','현재 표시 목록','Lista actual','Liste actuelle','Aktuelle Liste'],
    ['{count} 条消息使用已加载的纯文本缓存，部分格式不可用。','{count} messages use cached plain text; some formatting is unavailable.','{count} 則訊息使用已載入的純文字快取，部分格式無法使用。','{count} 件はキャッシュのプレーンテキストを使用しています。一部の書式は利用できません。','메시지 {count}개는 일반 텍스트 캐시를 사용하여 일부 서식이 없습니다.','{count} mensajes usan texto en caché; parte del formato no está disponible.','{count} messages utilisent le texte brut en cache ; certaines mises en forme sont indisponibles.','{count} Nachrichten verwenden Klartext aus dem Cache; einige Formatierungen fehlen.'],
    ['对话导出','Conversation export','對話匯出','会話のエクスポート','대화 내보내기','Exportación de conversación','Export de conversation','Gesprächsexport'],
    ['范围：{scope}，{count} 条已加载消息。未加载内容不包含。','Scope: {scope}, {count} loaded messages. Unloaded content is not included.','範圍：{scope}，{count} 則已載入訊息。不包含未載入內容。','範囲：{scope}、読み込み済み {count} 件。未読込の内容は含まれません。','범위: {scope}, 불러온 메시지 {count}개. 불러오지 않은 내용은 제외됩니다.','Alcance: {scope}, {count} mensajes cargados. No incluye contenido sin cargar.','Portée : {scope}, {count} messages chargés. Le contenu non chargé est exclu.','Bereich: {scope}, {count} geladene Nachrichten. Nicht geladene Inhalte sind ausgeschlossen.'],
    ['已导出 {count} 条已加载消息','Exported {count} loaded messages','已匯出 {count} 則已載入訊息','読み込み済み {count} 件を出力しました','불러온 메시지 {count}개를 내보냈습니다','Se exportaron {count} mensajes cargados','{count} messages chargés exportés','{count} geladene Nachrichten exportiert'],
    ['导出失败，请稍后重试。','Export failed. Please try again.','匯出失敗，請稍後重試。','出力に失敗しました。再試行してください。','내보내지 못했습니다. 다시 시도하세요.','Error al exportar. Inténtalo de nuevo.','Échec de l’export. Réessayez.','Export fehlgeschlagen. Bitte erneut versuchen.'],
    ['已识别 {count} 条已加载消息','Detected {count} loaded messages','已辨識 {count} 則已載入訊息','読み込み済み {count} 件を検出しました','불러온 메시지 {count}개를 인식했습니다','Se detectaron {count} mensajes cargados','{count} messages chargés détectés','{count} geladene Nachrichten erkannt'],
    ['仅本次页面实际加载过的消息；刷新或切换会话后重新建立','Only messages loaded on this page; rebuilt after refresh or chat changes','僅本次頁面實際載入過的訊息；重新整理或切換對話後重建','このページで読み込んだメッセージのみ。再読込や会話切替で再構築します','현재 페이지에서 불러온 메시지만 포함하며 새로고침이나 대화 전환 시 다시 구성합니다','Solo mensajes cargados en esta página; se reconstruye al recargar o cambiar de chat','Messages chargés sur cette page uniquement ; recréés après actualisation ou changement de conversation','Nur auf dieser Seite geladene Nachrichten; nach Neuladen oder Chatwechsel neu aufgebaut'],
    ['点击已加载节点时按需自动翻页定位；失败提示重试，不弹缓存正文','Selecting observed markers loads pages as needed; failures offer retry, not a cached-text viewer','點選已載入節點時才按需翻頁定位；失敗可重試，不顯示快取正文視窗','読み込み済みのマーカーを選択した時のみページを移動。失敗時は再試行を表示し、キャッシュ表示で代用しません','불러온 노드 선택 시에만 필요한 페이지를 로딩합니다. 실패 시 다시 시도하며 캐시 뷰어로 대체하지 않습니다','Seleccionar marcadores carga páginas según sea necesario; en caso de fallo permite reintentar sin mostrar una copia en caché','La sélection charge les pages nécessaires ; un échec propose de réessayer, sans lecteur de texte en cache','Markierungen laden bei Bedarf Seiten nach; bei Fehlern erneut versuchen, ohne Cache-Textfenster'],
    ['每条正文最多120000字符；超出总缓存预算时仅保留摘要与节点','Up to 120,000 characters per message; summaries and markers remain after the cache limit','每則正文最多 120,000 字元；超過快取預算後僅保留摘要與節點','本文は 1 件 120,000 文字まで。キャッシュ上限を超えると要約とマーカーのみ保持します','메시지당 최대 120,000자이며 캐시 한도를 넘으면 요약과 노드만 유지합니다','Hasta 120.000 caracteres por mensaje; al alcanzar el límite se conservan resúmenes y marcadores','Jusqu’à 120 000 caractères par message ; au-delà du cache, seuls résumés et repères sont conservés','Bis zu 120.000 Zeichen je Nachricht; nach Erreichen des Cache-Limits bleiben Zusammenfassungen und Markierungen'],
    ['无法读取扩展设置。扩展更新后，请刷新页面。','Could not read extension settings. Refresh the page after updating.','無法讀取擴充功能設定。更新後請重新整理頁面。','拡張機能の設定を読み込めません。更新後はページを再読み込みしてください。','확장 설정을 읽지 못했습니다. 업데이트 후 페이지를 새로고침하세요.','No se pudo leer la configuración. Recarga la página tras actualizar.','Impossible de lire les réglages. Actualisez la page après la mise à jour.','Erweiterungseinstellungen nicht lesbar. Seite nach dem Update neu laden.'],
    ['当前页面','Current page','目前頁面','現在のページ','현재 페이지','Página actual','Page actuelle','Aktuelle Seite'],
    ['CSS 选择器语法无效','Invalid CSS selector syntax','CSS 選擇器語法無效','CSS セレクターの構文が無効です','CSS 선택자 문법이 올바르지 않습니다','Sintaxis de selector CSS no válida','Syntaxe de sélecteur CSS invalide','Ungültige CSS-Selektorsyntax'],
    ['图片','Image','圖片','画像','이미지','Imagen','Image','Bild'],
    ['[图片]','[Image]','[圖片]','[画像]','[이미지]','[Imagen]','[Image]','[Bild]'],
    ['[图片、音频或其他非文本消息]','[Image, audio, or other non-text message]','[圖片、音訊或其他非文字訊息]','[画像・音声などのテキスト以外のメッセージ]','[이미지, 오디오 또는 기타 비텍스트 메시지]','[Imagen, audio u otro mensaje no textual]','[Image, audio ou autre message non textuel]','[Bild, Audio oder andere nicht textbasierte Nachricht]'],
    ['[非文本消息或内容尚未呈现]','[Non-text message or content not yet rendered]','[非文字訊息或內容尚未顯示]','[テキスト以外のメッセージ、または未表示の内容]','[비텍스트 메시지 또는 아직 표시되지 않은 내용]','[Mensaje no textual o contenido aún no visible]','[Message non textuel ou contenu pas encore affiché]','[Nicht textbasierte Nachricht oder noch nicht angezeigter Inhalt]'],
    ['[索引已截断]','[Index truncated]','[索引已截斷]','[インデックスは省略されています]','[색인이 잘렸습니다]','[Índice truncado]','[Index tronqué]','[Index gekürzt]'],
    ['未识别','Not detected','未辨識','未検出','인식되지 않음','No detectado','Non détecté','Nicht erkannt'],
    ['不是有效的 对话时间轴助手 收藏备份。','This is not a valid Conversation Timeline bookmark backup.','這不是有效的對話時間軸助手收藏備份。','有効な会話タイムラインのブックマークバックアップではありません。','올바른 대화 타임라인 북마크 백업이 아닙니다.','No es una copia válida de los marcadores de Cronología de conversaciones.','Ce n’est pas une sauvegarde valide des favoris de Conversation Timeline.','Keine gültige Lesezeichen-Sicherung von Conversation Timeline.'],
    ['备份条目超过 20,000 条限制。','The backup exceeds the 20,000-entry limit.','備份項目超過 20,000 則限制。','バックアップは上限の 20,000 件を超えています。','백업이 최대 20,000개 항목을 초과했습니다.','La copia supera el límite de 20.000 entradas.','La sauvegarde dépasse la limite de 20 000 entrées.','Die Sicherung überschreitet das Limit von 20.000 Einträgen.'],
    ['备份中存在无效的收藏记录，未导入。','The backup contains invalid bookmarks and was not imported.','備份含有無效的收藏記錄，未匯入。','無効なブックマークが含まれているため、インポートしませんでした。','백업에 잘못된 북마크가 있어 가져오지 않았습니다.','La copia contiene marcadores no válidos y no se ha importado.','La sauvegarde contient des favoris invalides et n’a pas été importée.','Die Sicherung enthält ungültige Lesezeichen und wurde nicht importiert.'],
    ['跟随浏览器','Browser language','跟隨瀏覽器','ブラウザーに合わせる','브라우저 언어','Idioma del navegador','Langue du navigateur','Browsersprache'],
    ['界面语言','Interface language','介面語言','表示言語','인터페이스 언어','Idioma de la interfaz','Langue de l’interface','Oberflächensprache']
  ];
  const columns = ['en','zh-TW','ja','ko','es','fr','de'];
  for (const row of rows) {
    catalogs['zh-CN'][row[0]] = row[0];
    columns.forEach((locale,index) => { catalogs[locale][row[0]] = row[index + 1]; });
  }
  const api = Object.freeze({LANGUAGES,resolve,t,register});
  root.GTNextI18n = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(globalThis);
