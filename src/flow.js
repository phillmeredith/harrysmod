const VERSION = "4.2.0";
// Hidden from the home screen for now (Phill, 2026-11-18). Empty the list to bring them back.
const HIDDEN_KINDS = ["better","idea"];
const KINDS = {
  broken:{label:"Report bug", sub:"It went wrong", word:"Bug report"},
  better:{label:"Improve a feature", sub:"It works, but…", word:"Improve a feature"},
  idea:{label:"Build something new", sub:"Something new!", word:"Build something new"}
};
const PER = 7; // tiles per screen before grouping, leaving room for one extra tile
const snake = s => s.toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"");
const leaves = (names, prefix, tp) => names.map(n => Array.isArray(n) ? {l:n[0], id:n[1], tp} : {l:n, id:prefix+snake(n), tp});
const fromObj = (o, prefix, tp) => Object.entries(o).map(([k,v]) => ({l:k, tp, k: Array.isArray(v) ? leaves(v, prefix, tp) : fromObj(v, prefix, tp)}));

/* ---------- What it is about ---------- */
const HORSE_NAMES = ["Autumn","Delilah","Dollar","Foxy","Heidi","Jack","Katie","Maggie","May","Molly May","Mouse","Penny","Rolo","Romany","Splash","Tess","Timmy"];
const COATS = ["#7A4A2B","#C9A27A","#3B2A20","#E9E2D6","#A0522D","#5A3B26","#D8C3A0","#8C6A4F"];
const BREEDS = ["Thoroughbred","Arabian","Shetland pony","Welsh pony","Highland pony","Fell pony","Haflinger","Fjord","Gypsy cob","Shire","Clydesdale","Friesian","Appaloosa","Knabstrupper","American Paint","Mustang","Andalusian","Akhal-Teke","Quarter Horse","Unicorn","Galaxy horse","Candy horse","Zebra-ish"];
const sub = (cat, s) => MOD[cat][s];
const MOD_TREE = [
  {l:"Horses", tp:"horse", k:[
    {l:"My yard horses", tp:"horse", k: HORSE_NAMES.map((h,i)=>({l:h, id:"wrc_"+snake(h), tp:"horse", coin:COATS[i%COATS.length]})).concat([{l:"Type a name", typed:true, tp:"horse"}])},
    {l:"All my horses", id:"all_horses", tp:"horse"},
    {l:"Foals", tp:"foals", k: leaves(["A foal","Foal on the lead","Foal and its mum","Foal growing up","Twins","Breeding","Naming a foal"], "foal:", "foals")},
    {l:"Horse Designer", tp:"guide", k:[
      {l:"Breeds", tp:"horse", k: leaves(BREEDS, "breed:", "horse")},
      {l:"Coat colours", tp:"horse", k: leaves(D_BASES, "coat:", "horse")},
      {l:"Patterns", tp:"horse", k: leaves(D_PATTERNS, "pattern:", "horse")},
      {l:"Manes and tails", tp:"horse", k: leaves(D_MANES, "mane:", "horse")},
      {l:"Face markings", tp:"horse", k: leaves(D_FACES, "face:", "horse")},
      {l:"Leg markings", tp:"horse", k: leaves(D_LEGS, "legs:", "horse")},
      {l:"Eyes", tp:"horse", k: leaves(D_EYES, "eyes:", "horse")}]},
    {l:"Horse models", tp:"horse", k: leaves(["Classic horse","Realistic horse","Picking a model in the Designer","Changing a horse's model","Manes and tails (Realistic)","Tack on a Realistic horse","New horses setting"], "model:", "horse")},
    {l:"Hobby horses", tp:"item", k: leaves(sub("Hobby horses",""), "", "item")},
    {l:"How horses behave", tp:"horse", k: leaves(["Following me","Coming to the whistle","Eating and drinking","Sleeping and naps","Moods and personality","Rearing and bucking","Getting stuck","Making a mess","Rolling","Playing with toys"], "behave:", "horse")}
  ]},
  {l:"Horse tack and gear", tp:"item", k: Object.entries(MOD["Horse tack and gear"]).map(([s,v])=>({l:s, tp:"item", k:leaves(v,"","item")}))},
  {l:"Horse food, treats and potions", tp:"item", k: leaves(sub("Horse food, treats and potions",""), "", "item")},
  {l:"Rider clothes, tools and weapons", tp:"item", k:[
    {l:"Clothes and armour", tp:"item", k: leaves(sub("Rider clothes and armour",""), "", "item")},
    {l:"Tools and weapons", tp:"item", k: leaves(sub("Tools and weapons",""), "", "item")}]},
  {l:"Yard pieces", tp:"yard", k: Object.entries(MOD["Yard pieces"]).map(([s,v])=>({l:s, tp:"yard", k:leaves(v,"","yard")}))},
  {l:"The yard and places", tp:"yard", k: leaves(["Stables","Indoor school","Outdoor arena","Arena letters","Fields","Car park","Muck heap","Tack room","Pond","The road","Washington map around the yard","Beach trip","Forest trip"], "place:", "yard")},
  {l:"Horse Guide", tp:"guide", k: leaves(["The Horse Guide book","My horses","Horse passport","Jobs Board","Horse Book cards","Shop","Hall of Fame","Horse Designer","Horsebox trips","Tack screen","Settings","Calm mode","Grown-up tools"], "guide:", "guide")},
  {l:"Riding, jumping and shows", tp:"riding", k:[
    {l:"Riding", tp:"riding", k: leaves(["Getting on","Getting off","Walk","Trot","Canter","Gallop","Stopping","Turning","Jumping","Holding jump","Flying","Landing","Leading","Lunging"], "ride:", "riding")},
    {l:"Shows", tp:"shows", k: leaves(["Clear round","Bending","Barrels","Rosettes","Hall of Fame","Show jumps","Judges"], "show:", "shows")},
    {l:"Yard jobs", tp:"yard", k: leaves(["Mucking out","Feeding","Grooming","Turning out","Bringing in","Goodnight horses","Fran the Farrier","Filling water"], "job:", "yard")}]},
  {l:"Rosettes and plaques", tp:"item", k: leaves(sub("Rosettes and plaques",""), "", "item")},
  {l:"Coins and the shop", tp:"item", k: leaves(sub("Coins and money",""), "", "item").concat(leaves(["The shop","Prices","Shopping bag"], "shop:", "guide"))},
  {l:"Other mod things", tp:"item", k: leaves(sub("Other mod things",""), "", "item")}
];
const NEW_GROUPS = [
  ["Animals and people", [["A new horse or pony","animal"],["A new animal or creature","animal"],["A new mob or monster","animal"],["A new person to meet","other"]]],
  ["Things to hold or wear", [["A new item","item"],["A new tool or weapon","item"],["A new food or treat","item"],["A new thing to wear","item"],["A new thing for horses to wear","item"]]],
  ["Places and blocks", [["A new block","yard"],["A new building or place","yard"],["A new biome or land","other"],["A new dimension or world","other"]]],
  ["Things to do", [["A new show, game or challenge","shows"],["A new yard job","yard"],["A new way to travel","riding"],["A new power or magic","other"],["A new rule for the game","other"]]],
  ["Sounds and screens", [["A new sound or music","other"],["A new page or button in the Horse Guide","guide"],["A new button or menu in the game","other"]]]
];
const NEW_TREE = NEW_GROUPS.map(([g, items]) => ({l:g, tp:"other", k: items.map(([l,tp])=>({l, id:"new:"+snake(l.replace(/^A new /,"")), tp, isNew:true}))}));
const UNSURE = {l:"I'm not sure", id:"unsure", tp:"other", vague:true};
const ROOT = (withNew, withMc) => [
  {l:"Something in my mod", tp:"item", k: MOD_TREE},
  ...(withMc ? [{l:"Something in normal Minecraft", tp:"other", k: fromObj(MC_TREE, "mc:", "other")}] : []),
  ...(withNew ? [{l:"Something brand new", tp:"other", k: NEW_TREE}] : []),
  UNSURE
];

/* ---------- What should change ---------- */
const COLOURS = ["White","Light grey","Grey","Black","Brown","Red","Orange","Yellow","Lime","Green","Cyan","Light blue","Blue","Purple","Magenta","Pink","Gold","Silver","Rainbow","Galaxy"];
const AMOUNTS = ["A tiny bit","A bit","Lots","Loads","As much as possible"];
const ch = (l, dt, opts) => ({l, id:"change:"+snake(l), dt, opts});
const CHANGES = [
  {l:"How it looks", k:[ch("Colour","colour"),ch("Bigger","amount"),ch("Smaller","amount"),ch("Pattern or markings","list",D_PATTERNS),ch("Glows","colour"),ch("Sparkles or particles","colour"),
    ch("Shape","list",["Rounder","Taller","Longer","Thinner","Fluffier","Wings","A horn","A longer tail","A longer mane","Spikes","Like a different thing"]),
    ch("Made of","list",["Wood","Stone","Metal","Gold","Diamond","Glass (see-through)","Ice","Crystal","Rainbow","Galaxy","Slime","Fluffy wool"]),
    ch("Moves its body","list",["Wags its tail","Nods its head","Rears up","Lies down","Rolls","Bucks","Dances","Sleeps","Shakes off water"]),
    ch("Easier to see","amount")]},
  {l:"How it moves", k:[ch("Faster","amount"),ch("Slower","amount"),ch("Jumps higher","amount"),ch("Can fly","none"),ch("Can swim","none"),ch("Follows me","none"),ch("Comes when I call","none"),
    ch("Stays where I put it","none"),ch("Goes somewhere by itself","thing"),ch("Teleports to me","none"),ch("Walks up blocks","none"),ch("Doesn't get stuck","none")]},
  {l:"What it does", k:[ch("Does something when I tap it","list",["Opens a menu","Gives me something","Plays a sound","Does a trick","Changes colour","Turns on or off"]),
    ch("Gives me something","thing"),ch("Makes something appear","thing"),ch("Heals or looks after","none"),ch("Protects me","none"),ch("Helps with a yard job","list",["Mucking out","Feeding","Grooming","Turning out","Bringing in","Filling water","Carrying things"]),
    ch("Grows or changes over time","none"),ch("Breaks blocks","none"),ch("Builds things","none"),ch("Shows a message","none"),ch("Makes friends with","thing"),ch("Does a trick","list",["Bows","Rears","Spins","Lies down","Jumps on command","Shakes hands","Fetches"])]},
  {l:"Sounds", k:[ch("A new sound","list",["Neigh","Whinny","Snort","Hoof clops","A bell","A happy tune","A fanfare","Cheering","A funny noise"]),ch("Louder","amount"),ch("Quieter","amount"),ch("No sound","none"),ch("Music","list",["Calm music","Happy music","Exciting music","Show music","Bedtime music"])]},
  {l:"How many or how often", k:[ch("More of them","amount"),ch("Fewer of them","amount"),ch("Happens more often","amount"),ch("Happens less often","amount"),ch("Lasts longer","amount"),ch("Wears out slower","amount"),ch("Cheaper","amount"),ch("Gives more coins or XP","amount")]},
  {l:"Where to get or find it", k:[ch("Sold in the shop","none"),ch("I can craft it","none"),ch("Found in a chest","none"),ch("Found out in the world","thing"),ch("In the Horse Guide","none"),ch("I start with it","none"),ch("A prize at a show","none"),ch("Put it somewhere new","thing")]},
  {l:"Who can use it", k:[ch("Only me","none"),ch("Laura too","none"),ch("Everyone","none"),ch("Only my horses","none"),ch("Only foals","none"),ch("Only grown-up horses","none")]},
  {l:"Make it work with something", k:[ch("Works with","thing"),ch("Fits on","thing"),ch("Turns into","thing"),ch("Joins up with","thing")]},
  {l:"Turn it off or take it away", k:[ch("Turn it off","none"),ch("Take it out of the game","none"),ch("Put it back how it was","none"),ch("Make it optional in settings","none")]},
  {l:"Something else", id:"change:something_else", dt:"none", vague:true}
];
const WHEN = ["All the time","When I tap it","When I hold it","When I whistle","When I'm riding","When I feed it","At night","In the day","When it rains","After a show","When I open my world","On my birthday"];
const ONLYIF = ["Only for my horses","Only when Laura's playing","Only in the yard","Only on horsebox trips","Only in creative mode","Only once a day","Only if I've got enough coins","Only for grown-up horses","Only for foals"];

const BROKEN = [
  {id:"vanished",label:"Vanished",exp:"it stays where it is and stays visible",act:"it disappeared"},
  {id:"stuck",label:"Won't move",exp:"it moves when asked",act:"it would not move"},
  {id:"looks",label:"Looks wrong",exp:"it looks the way it normally does",act:"it looked wrong (wrong colour, shape or missing bits)"},
  {id:"nothing",label:"Tapped, nothing happened",exp:"tapping does its job",act:"tapping did nothing"},
  {id:"wrongthing",label:"Did the wrong thing",exp:"it does what the Horse Guide says",act:"it did something different"},
  {id:"lost",label:"Lost my stuff",exp:"my things stay in my inventory or on the horse",act:"things went missing"},
  {id:"crash",label:"Game closed",exp:"the game keeps running",act:"Minecraft closed or froze"},
  {id:"sound",label:"Sounds wrong",exp:"the normal sound plays",act:"the sound was wrong or missing"},
  {id:"tooweak",label:"Too weak or won't go faster",exp:"it walks, trots, canters and gallops when asked",act:"it said it was too weak and would only walk"}
];
const BROKEN_FOR = {
  horse:["tooweak","vanished","stuck","looks","wrongthing","sound","crash"], foals:["vanished","stuck","looks","wrongthing","sound"],
  item:["vanished","looks","nothing","wrongthing","lost","sound","crash"], guide:["nothing","wrongthing","looks","lost","crash"],
  yard:["vanished","looks","nothing","wrongthing","sound","crash"], riding:["tooweak","stuck","wrongthing","looks","sound","crash"],
  shows:["nothing","wrongthing","looks","lost","crash"], other:BROKEN.map(b=>b.id)
};
const TAPPED = ["Tapped the horse","Tapped a block or thing","Used what was in my hand","Pressed a Horse Guide button","Got on or off","Jumped","Whistled","Just walking or riding","Don't know"];
const WORDS = ["Yes, words came up","No words","Don't remember"];
const WHERE_NEW = ["In the shop","In the Horse Guide","In the yard","Out in the world","I craft it","I start with it","A prize at a show","Somewhere else"];
const HOLD_TREE = () => [{l:"Nothing", id:"hand:empty", tp:"other"},
  ...MOD_TREE.filter(n=>["Horse tack and gear","Horse food, treats and potions","Rider clothes, tools and weapons","Coins and the shop","Other mod things"].includes(n.l)),
  {l:"Something from normal Minecraft", tp:"other", k: fromObj(MC_TREE.Items, "mc:", "other")},
  {l:"Don't know", id:"hand:unknown", tp:"other", vague:true}];
const DOING = ["Riding","Leading","Tapping it","Feeding or grooming","In the Horse Guide","Just opened my world","Don't know"];
const OFTEN = ["Every time","A few times","Just once"];

/* ---------- Grouping: never more than 8 tiles on a screen ---------- */
const isLeaf = n => !n.k;
function chunk(arr){
  if (arr.length <= 2*PER+1) return arr; // short lists just page with "More"
  const per = Math.pow(PER, Math.ceil(Math.log(arr.length)/Math.log(PER)) - 1);
  const out = [];
  for (let i=0;i<arr.length;i+=per){ const s=arr.slice(i,i+per); out.push(s.length===1 ? s[0] : {l:`${s[0].l} to ${s[s.length-1].l}`, sub:`${s.length} to pick from`, k:s, chunk:true, tp:s[0].tp}); }
  return out.length > PER ? chunk(out) : out;
}
function shown(node){ // children to show for a node (or the root list), grouped and with "Something else"
  const kids = node.k;
  const list = kids.every(isLeaf) ? chunk(kids) : kids;
  return list;
}

/* ---------- State ---------- */
const ico = d => `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const IC = { back: ico('<path d="M15 5l-7 7 7 7"/>'), up: ico('<path d="M12 19V5"/><path d="M6 11l6-6 6 6"/>'), x: ico('<path d="M6 6l12 12M18 6L6 18"/>') };
let S, drawer = false, showSaved = false, saveWarn = false;
const PART_KEYS = ["thing","like","where","change","detail","what","doing","holding","tapped","words","often","when","onlyif"];
function blankPart(){ return {thing:null, like:null, likeMode:null, where:null, change:null, detail:null, what:null, doing:null, holding:null, tapped:null, words:null, version:null, often:null, when:null, onlyif:null, pk:{path:[],page:0}}; }
function reset(){ S = {id:"r"+Date.now(), step:0, kind:null, app:null, free:null, freeTyping:false, parts:[], ...blankPart(), laura:false, shot:false, text:null, base:null, versions:[], sent:null}; }
const code = (s=S) => "HBT-" + s.id.slice(-4);

const STORE = "fixit_reports_v1";
function loadAll(){ try{ return JSON.parse(localStorage.getItem(STORE)||"{}"); }catch(e){ return {}; } }
function saveAll(o){ try{ localStorage.setItem(STORE, JSON.stringify(o)); return true; }catch(e){ return false; } }
function sentToday(){ const d=new Date().toDateString(); return Object.values(loadAll()).some(r=>r.sent && r.id!==S.id && new Date(r.sent).toDateString()===d) || (S.sent && new Date(S.sent).toDateString()===d && false); }
function persist(){
  if(!S.kind) return true;
  const all=loadAll(); all[S.id]={...S, typing:false, puz:null, updated:Date.now()};
  if (saveAll(all)) { saveWarn=false; return true; }
  all[S.id].shot=false; saveWarn = saveAll(all) ? "picture" : "all"; return false;
}
function addVersion(kind){
  const last = S.versions[S.versions.length-1];
  if (last && last.text === S.text && kind==="auto") return false;
  S.versions.push({t:Date.now(), kind, text:S.text}); persist(); return true;
}
function diffNote(a,b){
  if (a==null) return "First version";
  let i=0; while(i<a.length && i<b.length && a[i]===b[i]) i++;
  let j=0; while(j<a.length-i && j<b.length-i && a[a.length-1-j]===b[b.length-1-j]) j++;
  const cut = x => { x=x.replace(/\s+/g," ").trim(); return x.length>48 ? x.slice(0,46)+"…" : x; };
  const rem = cut(a.slice(i,a.length-j)), add = cut(b.slice(i,b.length-j));
  if (!rem && !add) return "No change";
  if (rem && add) return `Changed “${rem}” to “${add}”`;
  return add ? `Added “${add}”` : `Took out “${rem}”`;
}
const VLABEL = {start:"Made from his taps", auto:"Auto-saved", saved:"Saved", restored:"Went back to an older one", taps:"Updated after changing his taps", undo:"Undid all his changes"};
const clock = t => new Date(t).toLocaleTimeString([], {hour:"numeric",minute:"2-digit"});
function enterReview(){
  const fresh = sentence();
  if (S.text == null){ S.text = fresh; S.base = fresh; addVersion("start"); }
  else if (S.base !== fresh){ S.text = fresh; S.base = fresh; addVersion("taps"); }
}
function historyHTML(){
  const v = S.versions;
  return v.slice().reverse().map((x,ri)=>{ const i=v.length-1-ri;
    return `<li class="${i===v.length-1?"now":""}"><div><b>${VLABEL[x.kind]}</b> <span class="when">${clock(x.t)}</span><br><span class="what">${esc(diffNote(i?v[i-1].text:null, x.text))}</span></div>
      ${i===v.length-1?'<span class="pill">Now</span>':`<button class="go quiet small" data-restore="${i}">Use this one</button>`}</li>`; }).join("");
}
reset();

/* ---------- Steps ---------- */
function steps(){
  const s = ["kind"];
  if (S.kind === "broken") s.push("app");
  s.push("thing");
  if (S.kind === "broken" && isSkins()) s.push("what","doing","tapped","words","often");
  else if (S.kind === "broken"){ s.push("what","doing","holding","tapped","words","often"); if (!installedVersion()) s.push("version"); }
  else {
    if (S.thing?.isNew) s.push("like","where");
    s.push("change");
    if (S.change && S.change.dt && S.change.dt !== "none") s.push("detail");
    s.push("when","onlyif","more");
  }
  s.push("extras","review");
  return s;
}
const cur = () => S.step === "done" ? "done" : steps()[S.step];
const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const ORDER = ["kind","app","thing","like","where","change","detail","what","doing","holding","tapped","words","often","version","when","onlyif","shot"];
function clearAfter(key){
  ORDER.slice(ORDER.indexOf(key)+1).forEach(k=>{ S[k] = k==="shot" ? false : null; });
  if (key==="kind") S.parts = [];
  S.pk = {path:[],page:0}; S.likeMode=null; S.typing=false; S.amtWords=false; S.num=null; S.numLog=null;
}

// Which tree each picker step walks
function pickerRoot(st){
  if (st==="thing" && isSkins()) return {k: [...SKIN_TREE, SKIN_UNSURE]};
  if (st==="thing") return {k: S.kind==="idea" ? ROOT(true, false) : [...MOD_TREE, UNSURE]}; // reports are always about the mod, so skip the "in my mod" choice (Phill, 2026-11-18)
  if (st==="holding") return {k: HOLD_TREE()};
  if (st==="like") return {k: S.likeMode==="mod" ? MOD_TREE : fromObj(MC_TREE,"mc:","other")};
  if (st==="change") return {k: CHANGES};
  if (st==="detail"){
    const c = S.change;
    if (c.dt==="colour") return {k: leaves(COLOURS,"colour:","other")};
    if (c.dt==="amount") return {k: leaves(AMOUNTS,"amount:","other")};
    if (c.dt==="list") return {k: leaves(c.opts,"opt:","other")};
    if (c.dt==="thing") return {k: ROOT(false, true)};
  }
}
function pickerList(st){
  let node = pickerRoot(st), trail = [];
  for (const i of S.pk.path){ const list = shown(node); node = list[i]; if (!node) break; if (!node.chunk) trail.push(node.l); }
  return {node, list: shown(node), trail};
}
function pagedTiles(list){
  const page = S.pk.page||0;
  if (list.length <= 8) return {items: list.map((n,i)=>[n,i]), more:false};
  const start = page*PER, items = list.slice(start, start+PER).map((n,i)=>[n,start+i]);
  return {items, more: start+PER < list.length, page};
}

function tile(o){
  return `<button class="tile ${o.cls||""} ${o.sel?"sel":""}" data-v="${esc(o.v)}" aria-pressed="${!!o.sel}">
    ${o.coin ? `<span class="coin" style="background:${o.coin}">${esc(o.label[0])}</span>` : ""}
    <span>${esc(o.label)}</span>${o.sub?`<small>${esc(o.sub)}</small>`:""}</button>`;
}
const lc = s => s ? s.charAt(0).toLowerCase()+s.slice(1) : s;
const cap = s => s ? s.charAt(0).toUpperCase()+s.slice(1) : s;
function subj(p=S){ const t=p.thing; if(!t) return "it"; if(t.vague) return "something"; if(t.isNew) return lc(t.l)+(p.like?` like ${p.like.l}`:""); return t.l; }
const brokenObj = () => BROKEN.find(w=>w.id===S.what);

const QUESTIONS = {
  thing: () => S.pk.path.length ? "Which one?" : S.kind==="broken" && isSkins() ? "What went wrong in Skin Studio?" : S.kind==="broken" ? "What went wrong?" : S.kind==="better" ? "What do you want to make better?" : "What is your idea about?",
  like:  () => S.likeMode ? "Which one is it like?" : `Is ${subj()} like something that already exists?`,
  change:() => S.pk.path.length ? "Which one?" : S.kind==="idea" ? `What should ${subj()} be like or do?` : `What should change about ${subj()}?`,
  holding:() => S.pk.path.length ? "Which one?" : "What was in your hand?",
  detail:() => ({colour:"Which colour?", amount:"How much?", list:"Which one?", thing:"Which thing?"})[S.change.dt]
};

function render(){
  if (!deviceToken()) { renderLock(); return; }
  const app = document.getElementById("app"), st = cur();
  const head = `<div class="bar">
    <button class="round backbtn" id="back" aria-label="Back" ${S.step===0?"disabled":""}>${IC.back}<span>Back</span></button>
    ${S.parts.length && !["kind","done"].includes(st) ? `<span class="partno">Part ${S.parts.length+1}</span>`:""}
    <div class="spacer"></div>
  </div>`;
  let body = "", q = "", eyebrow = "";
  document.body.classList.toggle("home", st==="kind");
  if (st === "kind"){
    const all = Object.values(loadAll()).filter(r=>r.id!==S.id && r.kind).sort((a,b)=>b.updated-a.updated);
    const drafts = all.filter(r=>!r.sent), sent = all.filter(r=>r.sent);
    const row = r => { const st = reportState(r); return `<div class="rrow"><button class="rcard" ${r.sent?`data-track="${r.id}"`:`data-resume="${r.id}"`}><span class="rkind k-${r.kind}"></span><span class="rwhat"><b>${esc((()=>{ const t=(r.parts?.[0]||r).thing; if(!t) return "Not finished"; if(t.vague) return (r.text||"Something").replace(/^(Something went wrong( in Skin Studio)?: |Make it better\. |New idea! )/,""); return t.l; })())}</b><small>${esc(r.app==="skins"?"Skin Studio bug":KINDS[r.kind].label)}</small></span><span class="rstate st-${st[0]}">${esc(st[1])}</span></button></div>`; };
    app.innerHTML = `<div class="title-screen">
      <div class="logo"><div class="lw"><img class="logoimg" src="${LOGO}" alt="Harry's Mod" draggable="false"><span class="badge">Beta</span></div></div>
      ${sentToday() ? `<div class="today">Today's report is with Daddy. Come back tomorrow to send the next one.</div>` : ""}
      <div class="menu">
        ${playerHTML()}
        ${releaseTile()}
        <div class="menurow">${Object.entries(KINDS).filter(([k])=>!HIDDEN_KINDS.includes(k)).map(([k,v])=>`<button class="tile mm ${k==="broken"?"primary":""}" data-v="${k}">${k==="broken"?"Report a bug":esc(v.label)}</button>`).join("")}<button class="tile mm" id="draftsbtn">Draft reports (${drafts.length})</button></div>
        <div class="menurow"><button class="tile mm" id="featbtn">Features</button><button class="tile mm" id="prevver">Previous versions${sent.some(needsCheck)?`<span class="vtag">Check</span>`:""}</button></div>
        ${showSaved==="drafts" ? `<div class="homeover" data-close="saved"><div class="inner savedlist"><div class="listlabel">Draft reports</div><p class="relhow">${drafts.length?"Not sent yet. Tap one to finish it.":"No drafts. When you start a report and don't send it, it waits here."}</p>${drafts.map(row).join("")}<button class="tile mm closeover" data-close="saved">Close</button></div></div>`:""}
        ${showSaved==="sent" && sent.length ? `<div class="homeover" data-close="saved"><div class="inner savedlist"><div class="listlabel">Previous requests</div>${sent.map(row).join("")}<button class="tile mm closeover" data-close="saved">Close</button></div></div>`:""}
        ${releasePanel()}${prevPanel()}
        ${featPanel()}${trackPanel()}${fbPanel()}
      </div>
      <div class="foot"><span>Harry's Equestrian ${esc(installedVersion()||VERSION)}</span><span aria-hidden="true">·</span><span>Made for Harry</span></div>
    </div>`;
    wire(); if (drawer) openDrawer(); return;
  }
  if (S.freeTyping && S.kind==="broken"){
    q = "Tell Daddy what went wrong";
    body = `<section class="editor freebox"><label for="freetext" class="row-label" style="margin:0">Type it in your own words</label>
      <p class="hint" style="margin:0">Say what happened and what you were doing. Daddy will read every word.</p>
      <textarea id="freetext" spellcheck="true" autocapitalize="sentences" placeholder="My horse says it's too weak to go faster than walk">${esc(S.free||"")}</textarea></section>
      <div class="btns"><button class="go quiet" id="freeback">Back to the choices</button><button class="go" id="freedone" ${S.free?"":"disabled"}>Done</button></div>
      <p class="note" style="text-align:center">Tip: tap the microphone on the keyboard to say it instead.</p>`;
  } else if (["thing","change","detail","holding"].includes(st) || (st==="like" && S.likeMode)){
    q = QUESTIONS[st]();
    if (st==="detail" && S.change.dt==="amount" && !S.amtWords){ ({q, body} = numberScreen()); }
    else if (st==="thing" && S.typing){
      q = "What is your horse called?";
      body = `<div class="namebox"><label for="hname">Type your horse's name</label>
        <input id="hname" type="text" autocomplete="off" autocapitalize="words" enterkeyhint="done" maxlength="30" placeholder="Horse's name">
        <div class="btns"><button class="go quiet" id="nameback">Back to the horses</button><button class="go" id="namedone" disabled>Done</button></div>
        <p class="note">Tip: tap the microphone on the keyboard to say the name instead.</p></div>`;
    } else {
      const {list, trail} = pickerList(st), pg = pagedTiles(list), chosen = S[st==="like"?"like":st];
      eyebrow = trail.length?`<div class="trail">${trail.map(esc).join(" › ")}</div>`:"";
      body = `<div class="grid">${pg.items.map(([n,i])=>tile({v:"i"+i, label:n.l, sub:n.sub || (n.k && !n.chunk ? `${countLeaves(n)} to pick from` : ""), coin:n.coin, cls:(n.coin?"horse":"")+(n.k?" folder":""), sel: chosen && !n.k && chosen.l===n.l && chosen.id===n.id})).join("")}
         ${pg.more?tile({v:"__more",label:"More",sub:"See the next page",cls:"folder"}):""}</div>`;
    }
  } else if (st === "like"){
    q = QUESTIONS.like();
    body = `<div class="grid">${tile({v:"lk:mod",label:"Like something in my mod"})}${tile({v:"lk:mc",label:"Like something in Minecraft"})}${tile({v:"lk:none",label:"No, it's totally new",sel:S.like===null&&S.likeMode===false})}</div>`;
  } else if (st === "what"){
    q = S.thing?.vague ? "What happened?" : `What happened to ${S.thing?.l}?`;
    const ok = BROKEN_FOR[S.thing?.tp] || BROKEN_FOR.other;
    body = `<div class="grid">${BROKEN.filter(w=>ok.includes(w.id)).map(w=>tile({v:w.id,label:w.label,sel:S.what===w.id})).join("")}</div>`;
  } else if (st === "app"){
    q = "Where is the bug?";
    body = `<div class="grid big2">${APPS.map(a=>tile({v:a.v,label:a.label,sub:a.sub,sel:S.app===a.v.slice(4)})).join("")}</div>`;
  } else if (st === "tapped"){
    q = "What did you do just before it happened?";
    body = `<div class="grid">${(isSkins()?SKIN_TAPPED:TAPPED).map(l=>tile({v:l,label:l,sel:S.tapped===l})).join("")}</div>`;
  } else if (st === "words"){
    q = "Did any words come up on the screen?";
    body = `<div class="grid big">${WORDS.map(l=>tile({v:l,label:l,sel:S.words===l})).join("")}</div>`;
  } else if (st === "version"){
    q = "Which version does your Horse Guide say?";
    const vs = (REL?.releases||[]).map(r=>r.version).slice(0,6); if (!vs.length) vs.push(VERSION);
    body = `<p class="hint" style="margin-top:-18px">It's on the front page of the Horse Guide.</p><div class="grid">${vs.map(v=>tile({v:"ver:"+v,label:v,sel:S.version===v})).join("")}${tile({v:"ver:?",label:"Don't know",sel:S.version==="?"})}</div>`;
  } else if (st === "where"){
    q = `Where would you find ${subj()}?`;
    body = `<div class="grid">${WHERE_NEW.map(l=>tile({v:l,label:l,sel:S.where===l})).join("")}</div><button class="go quiet" id="next">Skip</button>`;
  } else if (st === "doing"){
    q = "What were you doing?";
    body = `<div class="grid">${(isSkins()?SKIN_DOING:DOING).map(l=>tile({v:l,label:l,sel:S.doing===l})).join("")}</div>`;
  } else if (st === "often"){
    q = "Did it happen more than once?";
    body = `<div class="grid">${OFTEN.map(l=>tile({v:l,label:l,sel:S.often===l})).join("")}</div><button class="go quiet" id="next">Skip</button>`;
  } else if (st === "when"){
    q = "When should it happen?";
    body = `<div class="grid">${WHEN.slice(0,8).map(l=>tile({v:l,label:l,sel:S.when===l})).join("")}</div>
      <div class="grid">${WHEN.slice(8).map(l=>tile({v:l,label:l,sel:S.when===l})).join("")}</div><button class="go quiet" id="next">Skip</button>`;
  } else if (st === "onlyif"){
    q = "Only sometimes?";
    body = `<div class="grid">${ONLYIF.slice(0,8).map(l=>tile({v:l,label:l,sel:S.onlyif===l})).join("")}</div>
      <div class="grid">${ONLYIF.slice(8).map(l=>tile({v:l,label:l,sel:S.onlyif===l})).join("")}</div><button class="go quiet" id="next">Skip, it's always</button>`;
  } else if (st === "more"){
    q = "Anything else for this idea?";
    body = `<div class="soFar"><span>So far</span><p>${esc(sentence())}</p></div>
      <div class="grid big2">${tile({v:"more:add",label:"Add another part",sub:"Something else should happen too"})}${tile({v:"more:done",label:"That's everything",sub:"Go to the picture and check",cls:"primary"})}</div>`;
  } else if (st === "extras"){
    q = S.words==="Yes, words came up" ? "Can you show Daddy the words?" : "Want to show Daddy a picture?";
    body = `<p class="hint" style="margin-top:-18px">${S.words==="Yes, words came up"?"A screenshot of the words helps Daddy most. You can skip this.":"You can skip this."}</p><div class="extras">
      <div class="panel"><h2>Add a picture</h2>
        <div class="slot">${S.shot?`<img src="${S.shot}" alt="Harry's picture"><span class="tag">Picture added</span>`:`<span class="empty">No picture yet</span>`}</div>
        <input type="file" accept="image/*" id="pickfile" class="filepick">
        <div class="btns">${S.shot?`<button class="go quiet small" id="shotoff">Take it away</button><button class="go small" id="shoton">Pick a different one</button>`:`<button class="go small" id="shoton">Pick a screenshot</button>`}</div>
        <p class="note" style="color:var(--panel-ink);margin:0">To take one in the game, press the top button and volume up together.</p>
      </div></div><button class="go" id="next">${S.shot?"Next":"Skip"}</button>`;
  } else if (st === "review"){
    q = "Is this right?";
    enterReview();
    body = `<div class="chips"><span class="kindtag k-${S.kind}">${esc(KINDS[S.kind].label)}</span>${S.parts.length?`<span class="chip">${S.parts.length+1} parts</span>`:""}${S.shot?'<span class="chip">Picture</span>':""}<span class="chip">Report ${code()}</span></div>
      <section class="editor">
        <div class="edhead"><label for="msg" class="row-label" style="margin:0">What you want to tell Daddy</label><span class="status" id="status">${statusText()}</span></div>
        <p class="hint" style="margin:0">These are your words. Tap them to change or add anything.${S.kind==="broken"&&S.words==="Yes, words came up"&&!S.shot?" If you remember the words on the screen, add them here.":""}</p>
        <textarea id="msg" spellcheck="true" autocapitalize="sentences">${esc(S.text)}</textarea>
        <div class="btns left"><button class="go quiet small" id="save">Save</button><button class="go quiet small" id="undoall" ${S.text===S.base?"disabled":""}>Undo all my changes</button></div>
        <details class="hist" ${S.histOpen?"open":""} id="hist"><summary>My changes (<span id="vcount">${S.versions.length}</span>)</summary><ol id="vlist">${historyHTML()}</ol></details>
      </section>
      ${S.kind==="broken"&&!isSkins()?`<div class="laura"><span>Were you playing with Laura?</span><div class="btns"><button class="tile mm yn ${S.laura?"sel":""}" id="laurayes">Yes</button><button class="tile mm yn ${S.laura?"":"sel"}" id="laurano">No</button></div></div>`:""}
      <div class="btns"><button class="go quiet" id="fix">Change my taps</button>${sentToday() && !S.sent ? `<button class="go" id="later">Save it for tomorrow</button></div><p class="hint" style="text-align:center;margin:0">You've already sent one today. This one will be in "Not sent yet" for tomorrow.</p>` : `<button class="go" id="send">Send to Daddy</button></div>`}`;
  } else if (st === "done"){
    app.innerHTML = head + `<div class="done"><div class="toast"><div class="ic">✓</div><div><b>Report sent!</b><span>Thank you, Harry</span></div></div>
      <p>Daddy has your message. Claude will start fixing it.</p>
      ${SHOW_PUZZLE?puzzleHTML():""}
      <button class="go" id="again">Tell Daddy something else</button>
      <button class="go quiet small" id="resend">Didn't go to Daddy? Send it again</button></div>`;
    wire(); return;
  }
  const canType = S.kind==="broken" && !S.freeTyping && !S.typing && ["app","thing","what","doing","holding","tapped","words","often","version"].includes(st);
  if (canType) body += `<div class="typeit"><button class="go quiet" id="typeit">Can't find it? Type it instead</button></div>`;
  app.innerHTML = head + `<div class="q"><div>${eyebrow}<h1>${esc(q)}</h1></div></div>` + body;
  wire();
  if (drawer) openDrawer();
}
function countLeaves(n){ return n.k ? n.k.reduce((a,c)=>a+countLeaves(c),0) : 1; }
function statusText(){
  if (saveWarn==="picture") return "Words saved. The picture was too big to keep.";
  if (saveWarn==="all") return "Couldn't save. Send it now so it isn't lost.";
  return S.versions.length>1 ? `Saved ${clock(S.versions[S.versions.length-1].t)}` : "Saves by itself as you change it";
}

/* ---------- Words ---------- */
function partSentence(p){
  if (!p.change) return "";
  let s = `${cap(subj(p))}${p.where?` (${lc(p.where)})`:""}: ${lc(p.change.l)}`;
  if (p.detail?.num) s = `${cap(subj(p))}${p.where?` (${lc(p.where)})`:""}: ${p.detail.l}`;
  else if (p.detail) s += ` (${lc(p.detail.l)})`;
  if (p.when && p.when!=="All the time") s += `, ${lc(p.when)}`;
  if (p.onlyif) s += `, ${lc(p.onlyif)}`;
  return s + ".";
}
function sentence(){
  if (S.kind==="broken"){
    const w = brokenObj();
    if (S.free){ const pre = w ? brokenSentence(w) + " " : S.thing && !S.thing.vague ? `${isSkins()?"Skin Studio, ":""}${S.thing.l}: ` : isSkins() ? "Skin Studio: " : ""; return pre + S.free; }
    if (!w) return "";
    return brokenSentence(w);
  }
  const parts = [...S.parts, S].map(partSentence).filter(Boolean);
  const pre = S.kind==="better" ? "Make it better. " : "New idea! ";
  return pre + parts.join(" And: ");
}
function brokenSentence(w){
    let s = S.thing?.vague ? `Something went wrong${isSkins()?" in Skin Studio":""}: ${lc(w.label)}` : `${isSkins()?"Skin Studio, ":""}${S.thing?.l}: ${lc(w.label)}`;
    if (S.doing && S.doing!=="Don't know") s += ` when I was ${lc(S.doing).replace("in the horse guide","in the Horse Guide")}`;
    if (S.holding && !S.holding.vague) s += S.holding.id==="hand:empty" ? " with nothing in my hand" : ` holding ${S.holding.l}`;
    if (S.tapped && S.tapped!=="Don't know") s += `. Just before, I ${lc(S.tapped).replace(/^tapped/,"tapped").replace(/^just walking or riding/,"was just walking or riding").replace(/^got on or off/,"got on or off")}`;
    if (S.words==="Yes, words came up") s += ". Some words came up on the screen";
    s += "."; if (S.often) s += ` ${S.often}.`; return s;
}
const trailOf = t => t ? `${t.l}${t.id?` (id ${t.id})`:""}${t.trail?` [${t.trail.join(" › ")}]`:""}` : "…";
function prompt(){
  if (!S.kind) return "(Harry hasn't picked anything yet.)";
  const when = S.sent || Date.now(), d = new Date(when), L = [];
  L.push(`[Harry's Beta Testing] ${isSkins()?"Skin Studio bug report":KINDS[S.kind].word} · report ${code()}`);
  L.push(`Harry said: "${(S.text ?? sentence()) || "…"}"`, "");
  if (isSkins()) L.push(`App: Skin Studio (${SKINS_URL}) · iPad Pro · NOT the add-on`);
  else L.push(`Add-on: Harry's Equestrian ${versionText()} · iPad Pro · ${S.laura?"LAN game with Laura":"single player"}`);
  L.push(`Sent: ${d.toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short",year:"numeric"})}, ${d.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}`);
  if (S.kind==="broken"){
    const w = brokenObj();
    if (S.free) L.push(`Harry typed: "${S.free}"`);
    if (!S.app) L.push("Where: Harry typed it before saying if it's the mod or Skin Studio. Work it out from his words, otherwise ask Phill.");
    L.push(`About: ${trailOf(S.thing)}`);
    if (w) L.push(`What happened: ${w.label} (${w.id})`);
    if (S.doing) L.push(`Harry was: ${S.doing}`);
    if (S.holding) L.push(`In his hand: ${S.holding.id==="hand:empty"?"nothing":trailOf(S.holding)}`);
    if (S.tapped) L.push(`Just before: ${S.tapped}`);
    if (S.words) L.push(`Words on screen: ${S.words}${S.words==="Yes, words came up" ? (S.shot?" (see screenshot)":" (no screenshot; check Harry's sentence, otherwise ask)") : ""}`);
    if (S.often) L.push(`How often: ${S.often}`);
    if (w){ L.push("", "Steps (from Harry's taps):",
      `1. ${S.laura?"In a LAN game with Laura, ":""}${S.laura ? (S.doing && S.doing!=="Don't know" ? S.doing.toLowerCase() : "playing normally") : (S.doing && S.doing!=="Don't know" ? S.doing : isSkins() ? "Using Skin Studio" : "Playing normally")}${S.thing && !S.thing.vague?` with ${S.thing.l}`:""}${S.holding && S.holding.id!=="hand:empty" && !S.holding.vague ? `, holding ${S.holding.l}`:""}`,
      `2. ${S.tapped && S.tapped!=="Don't know" ? S.tapped : "(what he did just before is unknown)"}`,
      `3. ${S.thing?.l||"It"}: ${w.act}`, `Expected: ${w.exp}.`, `Actual: ${w.act}.`); }
  } else {
    [...S.parts, S].forEach((p,i)=>{
      if (!p.thing) return;
      L.push("", `Part ${i+1}`);
      L.push(`  thing:   ${trailOf(p.thing)}${p.thing.isNew?" (brand new)":""}`);
      if (p.like) L.push(`  like:    ${trailOf(p.like)}`);
      if (p.change) L.push(`  change:  ${p.change.l} (${p.change.id})${p.change.cat?` [${p.change.cat}]`:""}`);
      if (p.detail) L.push(`  detail:  ${trailOf(p.detail)}`);
      if (p.when) L.push(`  when:    ${p.when}`);
      if (p.onlyif) L.push(`  only if: ${p.onlyif}`);
    });
  }
  const bn = builderNotes(); if (bn.length) L.push("", "For the builder:", ...bn.map(x=>"- "+x));
  L.push(S.shot ? `Screenshot: 1 attached to this message (report ${code()}). If it's missing, ask Phill for it.` : "Screenshot: none", "");
  if (S.kind==="broken" && isSkins()) L.push("This is about the Skin Studio website (skins.phillm.dev), not Harry's Equestrian. Don't change or release the .mcaddon for it. Hold it for Phill: reproduce it on skins.phillm.dev on an iPad-sized screen, fix it in Skin Studio's own code, and tell Phill what changed.");
  else if (S.kind==="broken") L.push("Please reproduce this on the test server, check it against expected_behaviour.md, fix it in the next .mcaddon and add a check to the per-item test.");
  else if (S.kind==="better") L.push("Please suggest how to make this change (tap-only, no fail states), say what it would take, and add it to the feature plan.");
  else L.push("Please turn this into a feature idea for the plan (tap-only, no fail states), say what it would take, and ask Phill before building it.");
  return L.join("\n");
}

/* ---------- Taps ---------- */
function advance(){ S.step++; S.pk={path:[],page:0}; persist(); render(); }
function pick(v){
  const st = cur();
  if (st==="kind"){ if(S.kind!==v) clearAfter("kind"); S.kind=v; return advance(); }
  if (["thing","change","detail","holding","like"].includes(st) && (st!=="like" || S.likeMode)){
    if (v==="__more"){ S.pk.page=(S.pk.page||0)+1; return render(); }
    const {list, trail} = pickerList(st), n = list[+v.slice(1)];
    if (n.k){ S.pk.path.push(+v.slice(1)); S.pk.page=0; return render(); }
    if (n.typed){ S.typing=true; render(); setTimeout(()=>document.getElementById("hname")?.focus(),50); return; }
    const key = st;
    const val = {...n, trail}; delete val.k;
    if (st==="change") val.cat = trail[0];
    if (JSON.stringify(S[key])!==JSON.stringify(val)) clearAfter(key);
    S[key] = val; return advance();
  }
  if (st==="like"){
    if (v==="lk:none"){ if(S.like) clearAfter("like"); S.like=null; S.likeMode=false; return advance(); }
    S.likeMode = v==="lk:mod" ? "mod" : "mc"; S.pk={path:[],page:0}; return render();
  }
  if (st==="app"){ const a=v.slice(4); if(S.app!==a) clearAfter("app"); S.app=a; if(a==="skins") S.laura=false; return advance(); }
  if (st==="what"){ if(S.what!==v) clearAfter("what"); S.what=v; return advance(); }
  if (st==="doing"){ if(S.doing!==v) clearAfter("doing"); S.doing=v; return advance(); }
  if (st==="tapped"){ if(S.tapped!==v) clearAfter("tapped"); S.tapped=v; return advance(); }
  if (st==="words"){ if(S.words!==v) clearAfter("words"); S.words=v; return advance(); }
  if (st==="version"){ S.version=v.slice(4); return advance(); }
  if (st==="where"){ if(S.where!==v) clearAfter("where"); S.where=v; return advance(); }
  if (st==="often"){ S.often=v; return advance(); }
  if (st==="when"){ if(S.when!==v) clearAfter("when"); S.when=v; return advance(); }
  if (st==="onlyif"){ S.onlyif=v; return advance(); }
  if (st==="more"){
    if (v==="more:done") return advance();
    const p = {}; PART_KEYS.forEach(k=>p[k]=S[k]); S.parts.push(p);
    Object.assign(S, blankPart()); S.step = steps().indexOf("thing"); persist(); return render();
  }
}
function goBack(){
  const st = cur();
  if (st==="done"){ reset(); return render(); }   // after sending, Back goes to the home screen (Phill, 2026-11-19)
  if (S.typing){ S.typing=false; return render(); }
  if (S.freeTyping){ S.freeTyping=false; return render(); }
  if (st==="detail" && S.amtWords && !S.pk.path.length && !S.pk.page){ S.amtWords=false; return render(); }
  if (st==="detail"){ S.num=null; S.numLog=null; }
  if (["thing","change","detail","holding","like"].includes(st)){
    if (S.pk.page){ S.pk.page--; return render(); }
    if (S.pk.path.length){ S.pk.path.pop(); return render(); }
    if (st==="like" && S.likeMode){ S.likeMode=null; return render(); }
    if (st==="thing" && S.parts.length){ Object.assign(S, S.parts.pop()); S.pk={path:[],page:0}; S.step=steps().indexOf("more"); return render(); }
  }
  if (S.step>0){ S.step--; S.pk={path:[],page:0}; render(); }
}

function wire(){
  const $ = id => document.getElementById(id);
  if ($("typeit")) $("typeit").onclick=()=>{ S.freeTyping=true; render(); setTimeout(()=>$("freetext")?.focus(),50); };
  if ($("freetext")){
    const ta=$("freetext"), dn=$("freedone");
    ta.oninput=()=>{ dn.disabled=!ta.value.trim(); };
    $("freeback").onclick=()=>{ const v=ta.value.trim(); S.free=v||null; S.freeTyping=false; persist(); render(); };
    dn.onclick=()=>{ const v=ta.value.trim(); if(!v) return; S.free=v; S.freeTyping=false; S.step=steps().indexOf("extras"); S.pk={path:[],page:0}; persist(); render(); };
  }
  document.querySelectorAll(".tile[data-v]").forEach(b=>b.onclick=()=>pick(b.dataset.v));
  $("back") && ($("back").onclick=goBack);
  $("grown") && ($("grown").onclick=()=>{ drawer=!drawer; drawer?openDrawer():closeDrawer(); });
  $("next") && ($("next").onclick=advance);
  if ($("hname")){
    const inp=$("hname"), done=$("namedone");
    const finish=()=>{ const v=inp.value.trim(); if(!v) return; const nv=v.replace(/^./,c=>c.toUpperCase()); const val={l:nv, id:"named:"+nv, tp:"horse", trail:["Horses","My yard horses"]}; if(JSON.stringify(S.thing)!==JSON.stringify(val)) clearAfter("thing"); S.thing=val; S.typing=false; advance(); };
    inp.oninput=()=>{ done.disabled=!inp.value.trim(); };
    inp.onkeydown=e=>{ if(e.key==="Enter") finish(); };
    done.onclick=finish;
    $("nameback").onclick=()=>{ S.typing=false; render(); };
  }
  $("shoton") && ($("shoton").onclick=()=>$("pickfile").click());
  $("pickfile") && ($("pickfile").onchange=e=>{ const f=e.target.files&&e.target.files[0]; if(!f) return; shrink(f).then(u=>{ S.shot=u; persist(); render(); }).catch(()=>{}); });
  $("shotoff") && ($("shotoff").onclick=()=>{S.shot=false;persist();render();});
  $("laurayes") && ($("laurayes").onclick=()=>{S.laura=true;persist();render();});
  $("laurano") && ($("laurano").onclick=()=>{S.laura=false;persist();render();});
  $("fix") && ($("fix").onclick=()=>{ S.step=steps().indexOf("review")-2; S.pk={path:[],page:0}; render(); });
  $("send") && ($("send").onclick=shareSheet);
  $("again") && ($("again").onclick=()=>{reset();render();});
  $("resend") && ($("resend").onclick=()=>{ S.step=steps().indexOf("review"); render(); });
  $("draftsbtn") && ($("draftsbtn").onclick=()=>{ showSaved="drafts"; render(); });
  $("sentbtn") && ($("sentbtn").onclick=()=>{ showSaved="sent"; render(); });
  wireFeedback();
  wireTrack(); wireFeat();
  document.querySelectorAll("[data-resume]").forEach(b=>b.onclick=()=>{ const r=loadAll()[b.dataset.resume]; if(!r) return; S={...blankPart(), parts:[], ...r}; if(S.kind==="broken" && !S.app){ S.app="mod"; if(typeof S.step==="number" && S.step>=1) S.step++; } if(typeof S.step!=="number"||r.sent) S.step=steps().indexOf("review"); render(); });
  document.querySelectorAll("[data-op]").forEach(b=>b.onclick=()=>numOp(b.dataset.op));
  $("numdone") && ($("numdone").onclick=numDone);
  $("words") && ($("words").onclick=()=>{ S.amtWords=true; S.pk={path:[],page:0}; render(); });
  $("puzzle") && ($("puzzle").onclick=()=>{ S.puz=makePuzzle(); render(); });
  $("puzno") && ($("puzno").onclick=()=>{ S.puz=null; render(); });
  document.querySelectorAll("[data-ans]").forEach(b=>b.onclick=()=>{ if(S.puz && S.puz.picked===null){ S.puz.picked=+b.dataset.ans; render(); } });
  $("newver") && ($("newver").onclick=()=>{ showRelease=!showRelease; render(); });
  $("prevver") && ($("prevver").onclick=()=>{ showPrev=true; render(); });
  $("getver") && ($("getver").onclick=()=>{ const r=newRelease(); setTimeout(()=>{ if(r){ setInstalled(r.version); showRelease=false; render(); } }, 1500); });
  document.querySelectorAll(".relget[data-ver]").forEach(a=>a.addEventListener("click",()=>{ const v=a.dataset.ver; setTimeout(()=>{ setInstalled(v); render(); }, 1500); }));
  $("later") && ($("later").onclick=()=>{ clearTimeout(autoTimer); S.text=document.getElementById("msg")?.value ?? S.text; persist(); reset(); showSaved="drafts"; render(); });
  document.querySelectorAll("[data-close]").forEach(el=>el.onclick=e=>{ if(e.target!==el) return; if(el.dataset.close==="saved") showSaved=false; else if(el.dataset.close==="fb") closeFeedback(); else if(el.dataset.close==="prev") showPrev=false; else if(el.dataset.close==="track") closeTrack(); else if(el.dataset.close==="feat"){ showFeat=false; featPick=null; } else showRelease=false; render(); });
  document.querySelectorAll(".logo,.q h1").forEach(el=>{ let t=null; const go=()=>{ t=setTimeout(()=>{ drawer=!drawer; drawer?openDrawer():closeDrawer(); }, 1500); }; const stop=()=>clearTimeout(t);
    el.addEventListener("pointerdown",go); ["pointerup","pointerleave","pointercancel"].forEach(ev=>el.addEventListener(ev,stop)); el.addEventListener("contextmenu",e=>e.preventDefault()); });
  if ($("msg")) wireEditor();
}

let autoTimer=null;
function refreshHistory(){ const l=document.getElementById("vlist"); if(l){ l.innerHTML=historyHTML(); wireRestore(); } const c=document.getElementById("vcount"); if(c) c.textContent=S.versions.length; const u=document.getElementById("undoall"); if(u) u.disabled = S.text===S.base; const pp=document.getElementById("pp"); if(pp) pp.textContent=prompt(); }
function setStatus(t){ const e=document.getElementById("status"); if(e) e.textContent = saveWarn ? statusText() : t; }
function wireRestore(){ document.querySelectorAll("[data-restore]").forEach(b=>b.onclick=()=>{ S.text=S.versions[+b.dataset.restore].text; addVersion("restored"); const ta=document.getElementById("msg"); ta.value=S.text; ta.dispatchEvent(new Event("fit")); refreshHistory(); setStatus("Went back · saved "+clock(Date.now())); }); }
function wireEditor(){
  const ta=document.getElementById("msg");
  const fit=()=>{ ta.style.height="auto"; ta.style.height=ta.scrollHeight+4+"px"; }; fit(); ta.addEventListener("fit",fit);
  ta.oninput=()=>{ S.text=ta.value; fit(); setStatus("Changing…"); persistLater(); refreshHistory(); };
  function persistLater(){ clearTimeout(autoTimer); autoTimer=setTimeout(()=>{ if(addVersion("auto")) setStatus("Auto-saved "+clock(Date.now())); else setStatus("Saved"); refreshHistory(); },1500); }
  document.getElementById("save").onclick=()=>{ clearTimeout(autoTimer); S.text=ta.value; const last=S.versions[S.versions.length-1]; if(last && last.text===S.text){ if(last.kind!=="start") last.kind="saved"; persist(); } else addVersion("saved"); setStatus("Saved "+clock(Date.now())); refreshHistory(); };
  document.getElementById("undoall").onclick=()=>{ clearTimeout(autoTimer); S.text=S.base; ta.value=S.text; fit(); addVersion("undo"); setStatus("Back to the start · saved"); refreshHistory(); };
  document.getElementById("hist").ontoggle=e=>{ S.histOpen=e.target.open; };
  wireRestore();
}
function shrink(file){ return new Promise((ok,bad)=>{ const r=new FileReader(); r.onerror=bad; r.onload=()=>{ const im=new Image(); im.onerror=bad; im.onload=()=>{ const k=Math.min(1,1200/Math.max(im.width,im.height)); const c=document.createElement("canvas"); c.width=Math.round(im.width*k); c.height=Math.round(im.height*k); c.getContext("2d").drawImage(im,0,0,c.width,c.height); ok(c.toDataURL("image/jpeg",.8)); }; im.src=r.result; }; r.readAsDataURL(file); }); }
function openDrawer(){
  let d = document.getElementById("drawer");
  if (!d){ d = document.createElement("aside"); d.id="drawer"; d.className="drawer"; document.body.appendChild(d); }
  d.innerHTML = `<h3>What Claude will get <button class="x" id="dx" aria-label="Close">${IC.x}</button></h3>
    <p>Harry only edits his own words. Everything under them is added when he sends, and he can't change it.</p>
    <pre id="pp">${esc(prompt())}</pre><button class="copy" id="cp">Copy the message</button>`;
  document.getElementById("dx").onclick=()=>{drawer=false;closeDrawer();};
  document.getElementById("cp").onclick=e=>copy(e.target);
}
function closeDrawer(){ document.getElementById("drawer")?.remove(); }
function copy(btn){
  const t = prompt();
  const ok = ()=>{btn.textContent="Copied";setTimeout(()=>btn.textContent="Copy the message",1500);};
  try{ navigator.clipboard.writeText(t).then(ok,()=>sel()); }catch(e){ sel(); }
  function sel(){ const r=document.createRange(); r.selectNodeContents(document.getElementById("pp")); const s=getSelection(); s.removeAllRanges(); s.addRange(r); btn.textContent="Selected: press Copy"; }
}
function shareSheet(){
  clearTimeout(autoTimer); S.text = document.getElementById("msg")?.value ?? S.text; persist();
  const L = document.getElementById("layer");
  L.innerHTML = `<div class="scrim" id="scrim"><div class="sheet" role="dialog" aria-label="Share">
    <div class="grab"></div>
    <div class="prev">${S.shot?`<img src="${S.shot}" alt="">`:""}<div><b>${esc(KINDS[S.kind].word)} from Harry · ${code()}</b>${esc(S.text)}</div></div>
    <div class="people">
      <button class="person" id="dad"><span class="av" style="background:#6C8CA8">D</span>Daddy</button>
      <button class="person" disabled style="opacity:.5"><span class="av" style="background:#B07A9A">L</span>Laura</button>
    </div>
    <div class="apps">
      <button class="appi" id="dad2"><span class="ai" style="background:#34C759"></span>Messages</button>
      <span class="appi"><span class="ai" style="background:#1A84FF"></span>Mail</span>
      <span class="appi"><span class="ai" style="background:#FFCC00"></span>Notes</span>
    </div>
    <div class="note">Mockup of the iPad share sheet. Closing it without sending keeps the report in "Not sent yet".</div>
  </div></div>`;
  document.getElementById("scrim").onclick=e=>{ if(e.target.id==="scrim") L.innerHTML=""; };
  document.getElementById("dad").onclick=messages; document.getElementById("dad2").onclick=messages;
}
function messages(){
  const L = document.getElementById("layer");
  L.innerHTML = `<div class="scrim" style="align-items:center;padding:16px"><div class="imsg">
    <header>To: Daddy</header>
    <div class="body">${S.shot?`<img class="photo" src="${S.shot}" alt="">`:""}<div class="bubble">${esc(prompt())}</div></div>
    <footer><span>iMessage</span><button class="sendb" id="snd" aria-label="Send">${IC.up}</button></footer>
  </div></div>`;
  document.getElementById("snd").onclick=()=>{ L.innerHTML=""; S.sent=Date.now(); persist(); S.step="done"; render(); };
}

(function(){ const el=document.createElement("div"); el.id="pano"; el.setAttribute("aria-hidden","true"); el.style.backgroundImage="url(" + MAP + ")"; document.body.prepend(el); })();
render();
