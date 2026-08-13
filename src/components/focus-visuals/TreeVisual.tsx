import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { FocusVisualProps } from './types';

interface TreeVisualProps extends FocusVisualProps {
  duration: number;
  running?: boolean;
  leafAsset?: string;
}

interface PlacedLeaf {
  id: number;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  hue: number;
  brightness: number;
}

const TREE_SCENE_URL = '/visuals/tree/tree-scene.png';
const LEAF_URL = '/visuals/tree/leaf-01.png';
const LEAF_ASSETS = [
  '/visuals/tree/leaf-01.png',
];

const LEAVES: PlacedLeaf[] = [{"rotation":0,"hue":0,"brightness":1,"x":0.45366032210834556,"y":0.24550810014727539,"scale":0.59,"id":1},{"rotation":13,"hue":0,"brightness":1,"x":0.22144216691068819,"y":0.05277614138438879,"scale":0.65,"id":2},{"rotation":-45,"hue":3,"brightness":1,"x":0.33307467057101026,"y":0.22241531664212078,"scale":0.6,"id":3},{"rotation":-109,"hue":0,"brightness":1,"x":0.21264275256222553,"y":0.020920471281295983,"scale":0.56,"id":4},{"rotation":-129,"hue":0,"brightness":1,"x":0.20714494875549055,"y":0.0373932253313696,"scale":0.57,"id":5},{"rotation":66,"hue":-5,"brightness":1,"x":0.33415080527086383,"y":0.1319219440353461,"scale":0.57,"id":6},{"rotation":41,"hue":0,"brightness":1,"x":0.40551976573938509,"y":0.18815905743740793,"scale":0.54,"id":7},{"rotation":-85,"hue":0,"brightness":1,"x":0.32357247437774528,"y":0.11877761413843886,"scale":0.51,"id":8},{"rotation":-35,"hue":0,"brightness":1,"x":0.17532210834553444,"y":0.05424889543446243,"scale":0.57,"id":9},{"rotation":38,"hue":0,"brightness":1,"x":0.33307467057101031,"y":0.035375552282768792,"scale":0.59,"id":10},{"rotation":-78,"hue":0,"brightness":1,"x":0.32025622254758424,"y":0.13579528718703976,"scale":0.54,"id":11},{"rotation":-71,"hue":0,"brightness":1,"x":0.30597364568082003,"y":0.2524153166421208,"scale":0.68,"id":12},{"rotation":38,"hue":0,"brightness":1,"x":0.44981698389458263,"y":0.27772459499263619,"scale":0.6,"id":13},{"rotation":-58,"hue":2,"brightness":1,"x":0.40698389458272322,"y":0.24854197349042703,"scale":0.59,"id":14},{"rotation":-141,"hue":0,"brightness":1,"x":0.16398243045387989,"y":0.068703976435935177,"scale":0.64,"id":15},{"rotation":-108,"hue":0,"brightness":1,"x":0.38981698389458275,"y":0.16323269513991162,"scale":0.67,"id":16},{"rotation":7,"hue":-6,"brightness":1,"x":0.42970717423133242,"y":0.24450662739322537,"scale":0.59,"id":17},{"rotation":-22,"hue":0,"brightness":1,"x":0.22435578330893122,"y":0.14021354933726066,"scale":0.72,"id":18},{"rotation":0,"hue":0,"brightness":1,"x":0.40407027818448027,"y":0.1611045655375552,"scale":0.53,"id":19},{"rotation":0,"hue":0,"brightness":1,"x":0.33634699853587108,"y":0.11719440353460975,"scale":0.66,"id":20},{"rotation":-38,"hue":0,"brightness":1,"x":0.316207906295754,"y":0.23823269513991158,"scale":0.68,"id":21},{"rotation":0,"hue":0,"brightness":1,"x":0.11639824304538797,"y":0.28225331369661266,"scale":0.75,"id":22},{"rotation":0,"hue":0,"brightness":1,"x":0.44545387994143487,"y":0.31050810014727542,"scale":0.61,"id":23},{"rotation":0,"hue":0,"brightness":1,"x":0.33600292825768674,"y":0.01475699558173784,"scale":0.61,"id":24},{"rotation":-65,"hue":0,"brightness":1,"x":0.12259882869692534,"y":0.38321796759941085,"scale":0.63,"id":25},{"rotation":61,"hue":0,"brightness":1,"x":0.42017569546120065,"y":0.275979381443299,"scale":0.58,"id":26},{"rotation":15,"hue":0,"brightness":1,"x":0.18261346998535866,"y":0.067120765832106008,"scale":0.59,"id":27},{"rotation":0,"hue":0,"brightness":1,"x":0.098052708638360131,"y":0.24854197349042706,"scale":0.68,"id":28},{"rotation":28,"hue":0,"brightness":1,"x":0.31551976573938506,"y":0.26605301914580265,"scale":0.63,"id":29},{"rotation":0,"hue":0,"brightness":1,"x":0.22144216691068813,"y":0.0292120765832106,"scale":0.66,"id":30},{"rotation":-138,"hue":0,"brightness":1,"x":0.10686676427525627,"y":0.38294550810014732,"scale":0.68,"id":31},{"rotation":114,"hue":0,"brightness":1,"x":0.46374084919472919,"y":0.39352724594992633,"scale":0.76,"id":32},{"rotation":0,"hue":0,"brightness":1,"x":0.4692240117130308,"y":0.34667157584683356,"scale":0.58,"id":33},{"rotation":-123,"hue":0,"brightness":1,"x":0.32243777452415806,"y":0.018519882179676012,"scale":0.56,"id":34},{"rotation":-116,"hue":0,"brightness":1,"x":0.38282576866764273,"y":0.17637702503681879,"scale":0.66,"id":35},{"rotation":85,"hue":0,"brightness":1,"x":0.43265007320644217,"y":0.27047128129602355,"scale":0.54,"id":36},{"rotation":-162,"hue":0,"brightness":1,"x":0.17239385065885798,"y":0.08223122238586153,"scale":0.58,"id":37},{"rotation":0,"hue":0,"brightness":1,"x":0.47802342606149345,"y":0.37410898379970547,"scale":0.58,"id":38},{"rotation":36,"hue":0,"brightness":1,"x":0.3927306002928258,"y":0.20059646539027978,"scale":0.68,"id":39},{"rotation":-86,"hue":0,"brightness":1,"x":0.40773060029282576,"y":0.30101620029455078,"scale":0.71,"id":40},{"rotation":0,"hue":0,"brightness":1,"x":0.2316617862371888,"y":0.17905007363770251,"scale":0.64,"id":41},{"rotation":-68,"hue":0,"brightness":1,"x":0.11928257686676424,"y":0.11599410898379964,"scale":0.67,"id":42},{"rotation":-83,"hue":0,"brightness":1,"x":0.13543191800878474,"y":0.2351251840942562,"scale":0.68,"id":43},{"rotation":-61,"hue":6,"brightness":1,"x":0.44032942898975114,"y":0.36205449189985273,"scale":0.73,"id":44},{"rotation":-113,"hue":0,"brightness":1,"x":0.19325036603221085,"y":0.1149042709867452,"scale":0.67,"id":45},{"rotation":88,"hue":0,"brightness":1,"x":0.13211566617862378,"y":0.32136229749631806,"scale":0.74,"id":46},{"rotation":0,"hue":0,"brightness":1,"x":0.29060029282576871,"y":0.0786303387334315,"scale":0.61,"id":47},{"rotation":-94,"hue":0,"brightness":1,"x":0.30633235724743774,"y":0.04061119293078054,"scale":0.67,"id":48},{"rotation":0,"hue":0,"brightness":1,"x":0.12806734992679353,"y":0.11599410898379964,"scale":0.6,"id":49},{"rotation":-73,"hue":0,"brightness":1,"x":0.20717423133235727,"y":0.058394698085419694,"scale":0.61,"id":50},{"rotation":-104,"hue":0,"brightness":1,"x":0.45716691068814058,"y":0.3635272459499263,"scale":0.63,"id":51},{"rotation":0,"hue":0,"brightness":1,"x":0.32941434846266471,"y":0.24745213549337261,"scale":0.65,"id":52},{"rotation":94,"hue":2,"brightness":1,"x":0.38760614934114213,"y":0.23888807069219437,"scale":0.71,"id":53},{"rotation":0,"hue":0,"brightness":1,"x":0.15370424597364576,"y":0.26419734904270986,"scale":0.64,"id":54},{"rotation":0,"hue":0,"brightness":1,"x":0.28876281112737917,"y":0.037665684830633275,"scale":0.63,"id":55},{"rotation":-48,"hue":0,"brightness":1,"x":0.26935578330893117,"y":0.11157584683357871,"scale":0.64,"id":56},{"rotation":0,"hue":0,"brightness":1,"x":0.21449487554904834,"y":0.0952135493372606,"scale":0.56,"id":57},{"rotation":111,"hue":0,"brightness":1,"x":0.42715226939970719,"y":0.32523564064801175,"scale":0.68,"id":58},{"rotation":0,"hue":0,"brightness":1,"x":0.36894582723279651,"y":0.26954344624447718,"scale":0.64,"id":59},{"rotation":0,"hue":0,"brightness":1,"x":0.38833821376281119,"y":0.28012518409425624,"scale":0.56,"id":60},{"rotation":-89,"hue":0,"brightness":1,"x":0.31915080527086392,"y":0.22001472754050075,"scale":0.64,"id":61},{"rotation":0,"hue":0,"brightness":1,"x":0.3692898975109809,"y":0.22323269513991165,"scale":0.61,"id":62},{"rotation":0,"hue":0,"brightness":1,"x":0.17199121522693994,"y":0.18521354933726064,"scale":0.71,"id":63},{"rotation":0,"hue":0,"brightness":1,"x":0.21229868228404097,"y":0.11141384388807066,"scale":0.65,"id":64},{"rotation":-58,"hue":0,"brightness":1,"x":0.30050512445095168,"y":0.071921944035346075,"scale":0.63,"id":65},{"rotation":0,"hue":0,"brightness":1,"x":0.19178623718887267,"y":0.086921944035346116,"scale":0.68,"id":66},{"rotation":0,"hue":0,"brightness":1,"x":0.31220351390922407,"y":0.34787187039764356,"scale":0.68,"id":67},{"rotation":-106,"hue":0,"brightness":1,"x":0.27961932650073212,"y":0.13606774668630339,"scale":0.63,"id":68},{"rotation":-149,"hue":0,"brightness":1,"x":0.20311127379209365,"y":0.14959499263622977,"scale":0.67,"id":69},{"rotation":-111,"hue":0,"brightness":1,"x":0.26130307467057096,"y":0.14692194403534603,"scale":0.68,"id":70},{"rotation":0,"hue":0,"brightness":1,"x":0.18814055636896046,"y":0.14086892488954345,"scale":0.8,"id":71},{"rotation":36,"hue":0,"brightness":1,"x":0.31368228404099563,"y":0.064558173784977885,"scale":0.6,"id":72},{"rotation":-65,"hue":0,"brightness":1,"x":0.26206442166910693,"y":0.048630338733431519,"scale":0.68,"id":73},{"rotation":0,"hue":0,"brightness":1,"x":0.2177672035139093,"y":0.14463181148748155,"scale":0.66,"id":74},{"rotation":-101,"hue":0,"brightness":1,"x":0.25692532942898982,"y":0.066848306332842375,"scale":0.64,"id":75},{"rotation":78,"hue":0,"brightness":1,"x":0.35538067349926789,"y":0.33074374079528718,"scale":0.74,"id":76},{"rotation":118,"hue":0,"brightness":1,"x":0.3930746705710102,"y":0.39287187039764354,"scale":0.72,"id":77},{"rotation":0,"hue":0,"brightness":1,"x":0.36896046852122988,"y":0.35441826215022088,"scale":0.69,"id":78},{"rotation":50,"hue":0,"brightness":1,"x":0.34589311859443633,"y":0.40181885125184091,"scale":0.8,"id":79},{"rotation":51,"hue":0,"brightness":1,"x":0.38797950219619326,"y":0.31225331369661269,"scale":0.62,"id":80},{"rotation":-65,"hue":0,"brightness":1,"x":0.20751830161054174,"y":0.090139911634756931,"scale":0.71,"id":81},{"rotation":114,"hue":0,"brightness":1,"x":0.292796486090776,"y":0.12134020618556696,"scale":0.7,"id":82},{"rotation":-76,"hue":0,"brightness":1,"x":0.29608345534407021,"y":0.38376288659793811,"scale":0.79,"id":83},{"rotation":60,"hue":0,"brightness":1,"x":0.33743777452415807,"y":0.31481590574374074,"scale":0.54,"id":84},{"rotation":-70,"hue":0,"brightness":1,"x":0.3469985358711567,"y":0.27636229749631808,"scale":0.7,"id":85},{"rotation":0,"hue":0,"brightness":1,"x":0.16360907759882876,"y":0.27663475699558171,"scale":0.64,"id":86},{"rotation":61,"hue":0,"brightness":1,"x":0.41140556368960468,"y":0.35643593519882177,"scale":0.71,"id":87},{"rotation":-51,"hue":0,"brightness":1,"x":0.27999267935578331,"y":0.029756995581737805,"scale":0.76,"id":88},{"rotation":0,"hue":0,"brightness":1,"x":0.360878477306003,"y":0.292179675994109,"scale":0.68,"id":89},{"rotation":0,"hue":0,"brightness":1,"x":0.27192532942898973,"y":0.059756995581737811,"scale":0.71,"id":90},{"rotation":-76,"hue":0,"brightness":1,"x":0.33377745241581258,"y":0.37372606774668626,"scale":0.71,"id":91},{"rotation":-43,"hue":0,"brightness":1,"x":0.35285505124450955,"y":0.23070692194403536,"scale":0.74,"id":92},{"rotation":143,"hue":0,"brightness":1,"x":0.39201317715959005,"y":0.35027245949926361,"scale":0.79,"id":93},{"rotation":94,"hue":0,"brightness":1,"x":0.16030746705710108,"y":0.38736377025036822,"scale":0.64,"id":94},{"rotation":-152,"hue":0,"brightness":1,"x":0.081603221083455357,"y":0.44654639175257727,"scale":0.71,"id":95},{"rotation":-35,"hue":0,"brightness":1,"x":0.19323572474377748,"y":0.41736377025036814,"scale":0.78,"id":96},{"rotation":109,"hue":0,"brightness":1,"x":0.095497803806734963,"y":0.27330633284241529,"scale":0.7,"id":97},{"rotation":71,"hue":0,"brightness":1,"x":0.4252855051244509,"y":0.37667157584683353,"scale":0.78,"id":98},{"rotation":55,"hue":0,"brightness":1,"x":0.19106881405563689,"y":0.22481590574374083,"scale":0.7,"id":99},{"rotation":0,"hue":0,"brightness":1,"x":0.14384333821376283,"y":0.14850515463917524,"scale":0.62,"id":100},{"rotation":-58,"hue":0,"brightness":1,"x":0.2291215226939971,"y":0.18559646539027982,"scale":0.69,"id":101},{"rotation":-161,"hue":0,"brightness":1,"x":0.0969765739385066,"y":0.15052282768777608,"scale":0.71,"id":102},{"rotation":-51,"hue":0,"brightness":1,"x":0.15443631039531486,"y":0.36581737849779083,"scale":0.74,"id":103},{"rotation":0,"hue":0,"brightness":1,"x":0.17090043923865297,"y":0.36461708394698089,"scale":0.78,"id":104},{"rotation":83,"hue":0,"brightness":1,"x":0.18809663250366032,"y":0.17490427098674516,"scale":0.82,"id":105},{"rotation":-18,"hue":0,"brightness":1,"x":0.25622254758418739,"y":0.1747422680412371,"scale":0.72,"id":106},{"rotation":0,"hue":0,"brightness":1,"x":0.4315446559297218,"y":0.30019882179675988,"scale":0.54,"id":107},{"rotation":36,"hue":0,"brightness":1,"x":0.18226939970717426,"y":0.30194403534609721,"scale":0.71,"id":108},{"rotation":0,"hue":0,"brightness":1,"x":0.24997803806734992,"y":0.21385125184094253,"scale":0.71,"id":109},{"rotation":-146,"hue":0,"brightness":1,"x":0.0841581259150806,"y":0.25683357879234164,"scale":0.81,"id":110},{"rotation":0,"hue":0,"brightness":1,"x":0.32170571010248894,"y":0.16137702503681883,"scale":0.71,"id":111},{"rotation":124,"hue":0,"brightness":1,"x":0.14710102489019031,"y":0.1749042709867451,"scale":0.68,"id":112},{"rotation":119,"hue":0,"brightness":1,"x":0.097364568081991232,"y":0.329381443298969,"scale":0.78,"id":113},{"rotation":0,"hue":0,"brightness":1,"x":0.131398243045388,"y":0.14997790868924887,"scale":0.66,"id":114},{"rotation":-78,"hue":0,"brightness":1,"x":0.10393850658857984,"y":0.44627393225331369,"scale":0.67,"id":115},{"rotation":75,"hue":0,"brightness":1,"x":0.154077598828697,"y":0.31988954344624448,"scale":0.74,"id":116},{"rotation":167,"hue":0,"brightness":1,"x":0.065856515373352867,"y":0.35992636229749625,"scale":0.79,"id":117},{"rotation":-88,"hue":0,"brightness":1,"x":0.069143484626647114,"y":0.32485272459499265,"scale":0.75,"id":118},{"rotation":101,"hue":0,"brightness":1,"x":0.1251390922401171,"y":0.41643593519882177,"scale":0.68,"id":119},{"rotation":-70,"hue":0,"brightness":1,"x":0.1149341142020498,"y":0.45456553755522827,"scale":0.77,"id":120},{"rotation":-139,"hue":0,"brightness":1,"x":0.23388726207906296,"y":0.21330633284241532,"scale":0.79,"id":121},{"rotation":-40,"hue":0,"brightness":1,"x":0.14346998535871161,"y":0.46983799705449192,"scale":0.65,"id":122},{"rotation":-113,"hue":0,"brightness":1,"x":0.29902635431918012,"y":0.19617820324005888,"scale":0.61,"id":123},{"rotation":-123,"hue":0,"brightness":1,"x":0.27742313323572487,"y":0.17141384388807065,"scale":0.74,"id":124},{"rotation":-55,"hue":0,"brightness":1,"x":0.30999267935578328,"y":0.15990427098674515,"scale":0.77,"id":125},{"rotation":-164,"hue":0,"brightness":1,"x":0.10976573938506587,"y":0.40759941089838,"scale":0.79,"id":126},{"rotation":-98,"hue":0,"brightness":1,"x":0.2979502196193265,"y":0.34263622974963182,"scale":0.74,"id":127},{"rotation":-157,"hue":0,"brightness":1,"x":0.1767862371888726,"y":0.21772459499263619,"scale":0.78,"id":128},{"rotation":-45,"hue":0,"brightness":1,"x":0.14054172767203515,"y":0.28721649484536083,"scale":0.74,"id":129},{"rotation":76,"hue":0,"brightness":1,"x":0.10942166910688145,"y":0.31105301914580252,"scale":0.65,"id":130},{"rotation":58,"hue":0,"brightness":1,"x":0.25106881405563697,"y":0.23621502209131073,"scale":0.74,"id":131},{"rotation":-66,"hue":0,"brightness":1,"x":0.16138360175695454,"y":0.19525036818851252,"scale":0.75,"id":132},{"rotation":131,"hue":0,"brightness":1,"x":0.076822840409956072,"y":0.34279823269513987,"scale":0.74,"id":133},{"rotation":0,"hue":0,"brightness":1,"x":0.34333821376281115,"y":0.33674521354933729,"scale":0.74,"id":134},{"rotation":101,"hue":0,"brightness":1,"x":0.12188140556368963,"y":0.161759941089838,"scale":0.74,"id":135},{"rotation":0,"hue":0,"brightness":1,"x":0.08490483162518303,"y":0.30341678939617084,"scale":0.67,"id":136},{"rotation":-55,"hue":0,"brightness":1,"x":0.14016837481698396,"y":0.39794550810014728,"scale":0.81,"id":137},{"rotation":0,"hue":0,"brightness":1,"x":0.11051244509516839,"y":0.13754050073637702,"scale":0.72,"id":138},{"rotation":-99,"hue":0,"brightness":1,"x":0.26899707174231324,"y":0.23059646539027984,"scale":0.76,"id":139},{"rotation":-88,"hue":0,"brightness":1,"x":0.11635431918008782,"y":0.55487481590574372,"scale":0.74,"id":140},{"rotation":66,"hue":0,"brightness":1,"x":0.22181551976573938,"y":0.26899852724594991,"scale":0.75,"id":141},{"rotation":-45,"hue":0,"brightness":1,"x":0.21046120058565154,"y":0.24276141384388805,"scale":0.73,"id":142},{"rotation":-144,"hue":0,"brightness":1,"x":0.088565153733528579,"y":0.47425625920471282,"scale":0.81,"id":143},{"rotation":162,"hue":0,"brightness":1,"x":0.16359443631039536,"y":0.41120029455081,"scale":0.75,"id":144},{"rotation":-179,"hue":0,"brightness":1,"x":0.10538799414348471,"y":0.4939469808541973,"scale":0.75,"id":145},{"rotation":-121,"hue":5,"brightness":1,"x":0.094765739385065842,"y":0.1275036818851252,"scale":0.71,"id":146},{"rotation":96,"hue":0,"brightness":1,"x":0.37257686676427526,"y":0.38403534609720169,"scale":0.77,"id":147},{"rotation":-22,"hue":0,"brightness":1,"x":0.13103953147877007,"y":0.47371134020618555,"scale":0.76,"id":148},{"rotation":96,"hue":0,"brightness":1,"x":0.14164714494875549,"y":0.43274668630338731,"scale":0.76,"id":149},{"rotation":78,"hue":0,"brightness":1,"x":0.12004392386530016,"y":0.49487481590574373,"scale":0.84,"id":150},{"rotation":151,"hue":0,"brightness":1,"x":0.17457540263543198,"y":0.43329160530191452,"scale":0.71,"id":151},{"rotation":75,"hue":0,"brightness":1,"x":0.11710102489019039,"y":0.60882179675994108,"scale":0.76,"id":152},{"rotation":123,"hue":0,"brightness":1,"x":0.211896046852123,"y":0.17610456553755524,"scale":0.75,"id":153},{"rotation":-121,"hue":0,"brightness":1,"x":0.10683748169838944,"y":0.11599410898379967,"scale":0.71,"id":154},{"rotation":-43,"hue":0,"brightness":1,"x":0.1822840409956076,"y":0.4000736377025037,"scale":0.7,"id":155},{"rotation":-124,"hue":7,"brightness":1,"x":0.29172035139092245,"y":0.35910898379970541,"scale":0.78,"id":156},{"rotation":78,"hue":0,"brightness":1,"x":0.30745241581259158,"y":0.37705449189985268,"scale":0.73,"id":157},{"rotation":106,"hue":0,"brightness":1,"x":0.14456076134699858,"y":0.577621502209131,"scale":0.66,"id":158},{"rotation":0,"hue":0,"brightness":1,"x":0.15004392386530013,"y":0.55432989690721646,"scale":0.72,"id":159},{"rotation":-123,"hue":0,"brightness":1,"x":0.18554172767203508,"y":0.52072901325478649,"scale":0.62,"id":160},{"rotation":66,"hue":0,"brightness":1,"x":0.2005417276720351,"y":0.53425625920471276,"scale":0.72,"id":161},{"rotation":0,"hue":0,"brightness":1,"x":0.31112737920937039,"y":0.19388807069219438,"scale":0.65,"id":162},{"rotation":-71,"hue":0,"brightness":1,"x":0.10650805270863838,"y":0.580022091310751,"scale":0.68,"id":163},{"rotation":38,"hue":0,"brightness":1,"x":0.44654465592972181,"y":0.38883652430044185,"scale":0.73,"id":164},{"rotation":104,"hue":0,"brightness":1,"x":0.13504392386530018,"y":0.58793078055964654,"scale":0.75,"id":165},{"rotation":-147,"hue":0,"brightness":1,"x":0.14711566617862371,"y":0.52340206185567,"scale":0.72,"id":166},{"rotation":-172,"hue":0,"brightness":1,"x":0.09989019033674959,"y":0.607621502209131,"scale":0.71,"id":167},{"rotation":-119,"hue":0,"brightness":1,"x":0.19175695461200581,"y":0.50480117820324,"scale":0.66,"id":168},{"rotation":180,"hue":0,"brightness":1,"x":0.20571010248901897,"y":0.27047128129602355,"scale":0.72,"id":169},{"rotation":148,"hue":0,"brightness":1,"x":0.41763543191800878,"y":0.39298232695139906,"scale":0.76,"id":170},{"rotation":-31,"hue":0,"brightness":1,"x":0.15884333821376281,"y":0.49045655375552283,"scale":0.78,"id":171},{"rotation":0,"hue":0,"brightness":1,"x":0.18628843338213769,"y":0.19617820324005888,"scale":0.75,"id":172},{"rotation":106,"hue":0,"brightness":1,"x":0.42603221083455345,"y":0.39969072164948449,"scale":0.7,"id":173},{"rotation":-94,"hue":0,"brightness":1,"x":0.18627379209370415,"y":0.4367820324005891,"scale":0.82,"id":174},{"rotation":0,"hue":0,"brightness":1,"x":0.20859443631039531,"y":0.50185567010309273,"scale":0.81,"id":175},{"rotation":83,"hue":0,"brightness":1,"x":0.13616398243045391,"y":0.50905743740795273,"scale":0.74,"id":176},{"rotation":7,"hue":0,"brightness":1,"x":0.13066617862371888,"y":0.55056701030927835,"scale":0.79,"id":177},{"rotation":-73,"hue":0,"brightness":1,"x":0.2723133235724744,"y":0.20179675994108984,"scale":0.72,"id":178},{"rotation":0,"hue":0,"brightness":1,"x":0.2829209370424598,"y":0.21826951399116343,"scale":0.73,"id":179},{"rotation":75,"hue":0,"brightness":1,"x":0.22837481698389467,"y":0.37465390279823269,"scale":0.83,"id":180},{"rotation":0,"hue":0,"brightness":1,"x":0.40076866764275249,"y":0.51189248895434469,"scale":0.75,"id":181},{"rotation":134,"hue":0,"brightness":1,"x":0.33597364568081983,"y":0.50627393225331363,"scale":0.68,"id":182},{"rotation":-98,"hue":0,"brightness":1,"x":0.29209370424597364,"y":0.41038291605301913,"scale":0.8,"id":183},{"rotation":-27,"hue":0,"brightness":1,"x":0.33710834553440705,"y":0.44305596465390279,"scale":0.83,"id":184},{"rotation":-128,"hue":0,"brightness":1,"x":0.21887262079062958,"y":0.35643593519882177,"scale":0.82,"id":185},{"rotation":0,"hue":0,"brightness":1,"x":0.23240849194729135,"y":0.35229013254786445,"scale":0.78,"id":186},{"rotation":51,"hue":0,"brightness":1,"x":0.21959004392386539,"y":0.30690721649484531,"scale":0.77,"id":187},{"rotation":-180,"hue":0,"brightness":1,"x":0.21409224011713029,"y":0.32485272459499259,"scale":0.81,"id":188},{"rotation":0,"hue":0,"brightness":1,"x":0.42235724743777447,"y":0.58727540500736375,"scale":0.71,"id":189},{"rotation":-144,"hue":0,"brightness":1,"x":0.13177159590043924,"y":0.2572164948453608,"scale":0.78,"id":190},{"rotation":-159,"hue":0,"brightness":1,"x":0.40885065885797955,"y":0.60653166421207649,"scale":0.74,"id":191},{"rotation":-96,"hue":0,"brightness":1,"x":0.23863836017569551,"y":0.31667157584683359,"scale":0.78,"id":192},{"rotation":0,"hue":0,"brightness":1,"x":0.3056149341142021,"y":0.4170913107511045,"scale":0.83,"id":193},{"rotation":81,"hue":0,"brightness":1,"x":0.32647144948755497,"y":0.46596465390279823,"scale":0.79,"id":194},{"rotation":-23,"hue":0,"brightness":1,"x":0.3897877013177159,"y":0.48538291605301914,"scale":0.73,"id":195},{"rotation":-180,"hue":0,"brightness":1,"x":0.17857979502196189,"y":0.5946391752577318,"scale":0.71,"id":196},{"rotation":-156,"hue":0,"brightness":1,"x":0.13689604685212298,"y":0.49285714285714288,"scale":0.63,"id":197},{"rotation":0,"hue":0,"brightness":1,"x":0.17385797950219617,"y":0.5078571428571429,"scale":0.74,"id":198},{"rotation":94,"hue":0,"brightness":1,"x":0.34625183016105421,"y":0.4668924889543446,"scale":0.7,"id":199},{"rotation":-111,"hue":0,"brightness":1,"x":0.16725475841874088,"y":0.30221649484536078,"scale":0.68,"id":200},{"rotation":-33,"hue":0,"brightness":1,"x":0.38137628111273786,"y":0.48952871870397641,"scale":0.72,"id":201},{"rotation":121,"hue":0,"brightness":1,"x":0.38173499267935573,"y":0.51778350515463911,"scale":0.75,"id":202},{"rotation":0,"hue":0,"brightness":1,"x":0.40112737920937047,"y":0.56960235640648,"scale":0.81,"id":203},{"rotation":51,"hue":0,"brightness":1,"x":0.42532942898975112,"y":0.61215022091310756,"scale":0.75,"id":204},{"rotation":0,"hue":0,"brightness":1,"x":0.37444363103953149,"y":0.56087628865979378,"scale":0.73,"id":205},{"rotation":81,"hue":0,"brightness":1,"x":0.34918008784773069,"y":0.55083946980854193,"scale":0.69,"id":206},{"rotation":0,"hue":0,"brightness":1,"x":0.41542459736456816,"y":0.53932989690721644,"scale":0.73,"id":207},{"rotation":121,"hue":0,"brightness":1,"x":0.3711273792093705,"y":0.58378497790868922,"scale":0.71,"id":208},{"rotation":0,"hue":2,"brightness":1,"x":0.35245241581259146,"y":0.53103829160530192,"scale":0.76,"id":209},{"rotation":0,"hue":0,"brightness":1,"x":0.33304538799414346,"y":0.56665684830633278,"scale":0.8,"id":210},{"rotation":138,"hue":-6,"brightness":1,"x":0.39311859443631036,"y":0.54145802650957275,"scale":0.74,"id":211},{"rotation":-111,"hue":0,"brightness":1,"x":0.33784040995607612,"y":0.52994845360824738,"scale":0.79,"id":212},{"rotation":-144,"hue":0,"brightness":1,"x":0.058550512445095182,"y":0.34465390279823271,"scale":0.75,"id":213}];

function seededUnit(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

const LAND_DATA = new Map<number, { landX: number; landY: number; landRotation: number; zIndex: number; scale: number }>(
  LEAVES.map((leaf) => {
    const u1 = seededUnit(leaf.id + 101), u2 = seededUnit(leaf.id + 211);
    const u3 = seededUnit(leaf.id + 311), u4 = seededUnit(leaf.id + 411);
    const u5 = seededUnit(leaf.id + 511), u7 = seededUnit(leaf.id + 711);
    const tri = (u1 + u2) / 2;
    const rotDir = u4 < 0.5 ? -1 : 1;
    return [leaf.id, {
      landX: 0.05 + tri * 0.9,
      landY: 0.76 + u3 * 0.18,
      landRotation: leaf.rotation + rotDir * (8 + u5 * 22),
      zIndex: 3 + Math.floor(u7 * 3),
      scale: leaf.scale,
    }];
  })
);

const SHED_ORDER: number[] = LEAVES
  .map((l) => ({ id: l.id, order: seededUnit(l.id + 1) }))
  .sort((a, b) => a.order - b.order)
  .map((x) => x.id);

const SHED_RANK = new Map<number, number>(
  SHED_ORDER.map((id, idx) => [id, idx])
);

const TOTAL_LEAVES = LEAVES.length;

const SESSION_COLORS = [
  { hue: 15, saturate: 1.5, brightness: 1.25, dropGlow: '#ff6a13', label: 'warm-orange' },
  { hue: 30, saturate: 1.55, brightness: 1.3, dropGlow: '#ffb800', label: 'amber-gold' },
  { hue: -15, saturate: 1.6, brightness: 1.2, dropGlow: '#e0113f', label: 'crimson-red' },
  { hue: 8, saturate: 1.45, brightness: 1.15, dropGlow: '#c94a10', label: 'deep-rust' },
  { hue: 50, saturate: 1.55, brightness: 1.35, dropGlow: '#ffd700', label: 'golden-yellow' },
  { hue: 90, saturate: 1.5, brightness: 1.25, dropGlow: '#50c878', label: 'emerald-green' },
  { hue: 170, saturate: 1.55, brightness: 1.3, dropGlow: '#00d4aa', label: 'teal-cyan' },
  { hue: 210, saturate: 1.6, brightness: 1.3, dropGlow: '#0ea5ff', label: 'electric-blue' },
  { hue: 270, saturate: 1.55, brightness: 1.25, dropGlow: '#b44dff', label: 'violet-purple' },
  { hue: 315, saturate: 1.6, brightness: 1.25, dropGlow: '#ff44cc', label: 'hot-pink' },
];

function useReducedMotion() {
  const [r, setR] = useState(false);
  useEffect(() => {
    const q = window.matchMedia('(prefers-reduced-motion: reduce)');
    const u = () => setR(q.matches);
    u(); q.addEventListener('change', u);
    return () => q.removeEventListener('change', u);
  }, []);
  return r;
}

export default function TreeVisual({ progress, duration, leafAsset }: TreeVisualProps) {
  const assetUrl = leafAsset ?? LEAF_URL;
  const activeSession = duration > 0;
  const complete = progress >= 1;
  const reducedMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const boundaryRef = useRef(1);
  const [sessionLeafIndex, setSessionLeafIndex] = useState<number>(0);
  const [sessionColor] = useState(() => SESSION_COLORS[Math.floor(Math.random() * SESSION_COLORS.length)]);

  useEffect(() => {
    if (!activeSession) return;
    setSessionLeafIndex(Math.floor(Math.random() * LEAF_ASSETS.length));
  }, [activeSession]);

  useEffect(() => {
    if (!activeSession) return;
    const colon = document.querySelector('.flip-colon');
    const container = containerRef.current;
    if (colon && container) {
      const cr = container.getBoundingClientRect();
      const loc = colon.getBoundingClientRect();
      boundaryRef.current = Math.max(0.15, Math.min(0.98, (loc.left - cr.left) / cr.width));
    }
  }, [activeSession]);

  const shedCount = useMemo(() => {
    if (!activeSession || progress <= 0) return 0;
    if (complete || progress >= 0.95) return TOTAL_LEAVES;
    return Math.min(TOTAL_LEAVES, Math.floor(progress * TOTAL_LEAVES));
  }, [activeSession, complete, progress]);

  const leafStyles = useMemo(() => {
    const clampX = (rawX: number) => Math.min(rawX, boundaryRef.current - 0.008);
    const sessionLeafSrc = LEAF_ASSETS[sessionLeafIndex] ?? LEAF_URL;
    return LEAVES.map((leaf) => {
      const rank = SHED_RANK.get(leaf.id) ?? Infinity;
      const hasShed = activeSession && rank < shedCount;
      const land = LAND_DATA.get(leaf.id);

      let x: number, y: number, rot: number, zIdx: number | undefined;
      if (hasShed && land) {
        x = clampX(land.landX);
        y = land.landY;
        rot = land.landRotation;
        zIdx = land.zIndex;
      } else {
        x = clampX(leaf.x);
        y = leaf.y;
        rot = leaf.rotation;
        zIdx = undefined;
      }

      const cx = activeSession ? x * 100 : leaf.x * 100;
      const cy = activeSession ? y * 100 : leaf.y * 100;

      const style: CSSProperties = {
        left: `${cx}%`,
        top: `${cy}%`,
        transform: `translate(-50%,-50%) rotate(${rot}deg) scale(${leaf.scale})`,
        zIndex: zIdx,
        filter: activeSession 
          ? `hue-rotate(${sessionColor.hue}deg) saturate(${sessionColor.saturate}) brightness(${sessionColor.brightness})`
          : undefined,
      };
      const cls = (hasShed ? 'tree-placed-leaf tree-placed-leaf--landed' : 'tree-placed-leaf')
        + (reducedMotion ? ' tree-placed-leaf--instant' : '');
      return { id: leaf.id, style, cls, leafSrc: sessionLeafSrc };
    });
  }, [activeSession, shedCount, reducedMotion, sessionLeafIndex, sessionColor]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      console.log(
        `[TreeVisual] box=${Math.round(r.width)}x${Math.round(r.height)} aspect=${(r.width / r.height).toFixed(3)}`,
        `viewport=${vw}x${vh} aspect=${(vw / vh).toFixed(3)}`,
        `fillsScreen=${r.width >= vw - 1 && r.height >= vh - 1}`,
        `activeSession=${activeSession}`,
      );
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [activeSession]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      const container = containerRef.current;
      if (!container) return;
      const leaves = Array.from(container.querySelectorAll<HTMLElement>('.tree-placed-leaf'));
      const dump = leaves.map((leafEl) => {
        const img = leafEl.querySelector('img');
        const leafRect = leafEl.getBoundingClientRect();
        const imgRect = img ? img.getBoundingClientRect() : null;
        const id = leafEl.style.left + '|'
          + leafEl.style.top + '|'
          + leafEl.style.transform + '|'
          + 'box=' + Math.round(leafRect.width) + 'x' + Math.round(leafRect.height)
          + ' img=' + (imgRect ? `${Math.round(imgRect.width)}x${Math.round(imgRect.height)}@${Math.round(imgRect.left - leafRect.left)},${Math.round(imgRect.top - leafRect.top)}` : 'none');
        return id;
      });
      console.log('[TreeLeafAnchor]\n' + dump.join('\n'));
    }, 600);
    return () => window.clearTimeout(id);
  }, [leafStyles, activeSession]);

  return (
    <div
      ref={containerRef}
      className={`tree-leaf-editor focus-visual ${activeSession ? 'tree-leaf-editor--fullscreen' : 'tree-leaf-editor--preview'} ${complete ? 'visual-complete' : ''}`}
      role="img"
      aria-label={`Tree ${Math.round(progress * 100)} percent complete with ${TOTAL_LEAVES} placed leaves`}
    >
      {!activeSession && <img className="tree-leaf-editor__preview-bg" src={TREE_SCENE_URL} alt="" aria-hidden="true" />}
      <div className="tree-scene__completion-glow visual-finish-glow" aria-hidden="true" />

      {leafStyles.map((ls) => (
        <span
          key={ls.id}
          className={ls.cls}
          style={ls.style}
          aria-hidden="true"
        >
          <img src={ls.leafSrc} alt="" draggable={false} />
        </span>
      ))}
    </div>
  );
}