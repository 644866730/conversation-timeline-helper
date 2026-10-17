/* DEMO ONLY. Seed a previously observed conversation, then evict old page DOM. */
setTimeout(() => { NF.showPage(9); NF.auto = true; }, 550);
document.querySelector('#decoy').onclick = () => { if (!NF.busy) NF.showPage(Math.max(0, NF.page-1)); };
