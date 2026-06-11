let jf,
    tyList,
    trList,
    poList,
    deList,
    trainList = [],
    tiList = {
        jyokyo_1: "概ね平常運行",
        jyokyo_2: "運転見合わせ",
        jyokyo_3: "一部運転見合わせ",
        jyokyo_4: "遅れています"
    };

async function settings() {
    try {
        let r = await fetch(`https://a.opentidkeio.jp/config/system.json?ver=${new Date().getTime()}`);
        let reSy = await r.json();
        let sys = reSy.system;
        let v = sys.find(it => "version" in it).version;
        jf = sys.find(it => "jsonfile" in it).jsonfile;

        let tInfo = await fetch(`https://a.opentidkeio.jp/unkouinf/unkou_pub2.csv?_=${new Date().getTime()}`);
        let tres = await tInfo.text();
        let tiData = tres.split('\r\n');
        for (var i = 0; i < tiData.length; i++) {
            tiData[i] = tiData[i].split(',');
        };
        tiData = tiData.find(d => d[0] == "senku_1");
        document.getElementById("tr_info").innerText = tiList[tiData[1]];

        let [reTy, rePo, reDe] = await Promise.all([
            fetch(`https://a.opentidkeio.jp/config/syasyu.json?ver=${v}`)
            .then(r => r.json()),
            fetch(`https://a.opentidkeio.jp/config/position.json?ver=${v}`)
            .then(r => r.json()),
            fetch(`https://a.opentidkeio.jp/config/ikisaki.json?ver=${v}`)
            .then(r => r.json())
        ]);
        tyList = reTy.syasyu.filter(it => it["style"] != "STYLE_STOP_DUMMY");
        trList = [
            {
                code: "0",
                name: "都営10-300形車両"
            },
            {
                code: "1",
                name: ""
            },
            {
                code: "2",
                name: "京王2000系車両"
            },
            {
                code: "3",
                name: ""
            },
            {
                code: "4",
                name: "京王電鉄車両"
            },
            {
                code: "5",
                name: "京王5000系車両"
            },
            {
                code: "6",
                name: ""
            },
            {
                code: "7",
                name: "京王電鉄車両"
            },
            {
                code: "8",
                name: "京王電鉄車両"
            },
            {
                code: "9",
                name: "京王9000系車両"
            },
            {
                code: "99",
                name: ""
            }
        ];
        poList = new Map(rePo.pos.map(p => [p.ID, p]));
        deList = reDe.ikisaki;
        getPosition();
    } catch (er) {
        console.error(er);
    }
}

async function getPosition() {
    document.getElementById("displayStatus").innerText = "読み込み中...";
    let data2 = [];
    try {
        let r = await fetch(`https://a.opentidkeio.jp/${jf}?ver=${new Date().getTime()}`)
        let reIn = await r.json();
        let data = (reIn.TB.concat(reIn.TS)).filter(it => it["sn"] != "I");
        //bs 番線 dl 遅延分数 ik 行先 ik_tr 詳細行先 inf 案内 ki 0上1下 sr 両数 sy 種別 sy_tr 詳細種別？ tr 列番 sk 車両形式
        console.log(data);
        const setTrainData = async function* (items) {
            for (const tr of items) {
                dt = {};
                dt.trk = tr.bs.replace("S", "");
                dt.del = Number(tr.dl);
                dt.info = tr.inf;
                dt.dir = Number(tr.ki);
                dt.car = Number(tr.sr);
                dt.num = tr.tr.replace(/\s/g, "");
                dt.ser = await trList.find(d => d.code == tr.sk).name;
                dt.trn = await tyList.find(d => d.code == tr.sy).name;
                dt.trn2 = await tyList.find(d => d.code == tr.sy_tr).name;
                st = await deList.find(d => d.code == tr.ik_tr).name;
                dt.st = `${st}行`;
                yield dt;
            }
        }
        for (const item of data) {
            sec = await Promise.resolve(poList.get(item.id));
            if (sec) {
                data2[data2.length] = {
                    train: [],
                    section: `${sec.name}${sec.kind}`
                };
                for await (const dt of setTrainData(item.ps)) {
                    data2[data2.length - 1].train[data2[data2.length - 1].train.length] = dt;
                }
            }
        }
        console.log(data2);
        createTrainData(data2);
    } catch (er) {
        console.error(er);
    }
}

async function createTrainData(allTrainData) {
    trainList = [];
    const deleteTrain = async function* (items) {
        const positionData = items.section;
        for (const trainData of items.train) {
            try {
                const r = await fetch(`https://a.opentidkeio.jp/dia/${trainData.num}.json?ts=${new Date().getTime()}`);
                const re = await r.json();
                const res = re.dy;
                let ko39 = res.findIndex(e => e.sn == "若葉台");
                if (ko39 != -1) if (res[ko39].pa == "1" && res[ko39].ht != "") {
                    let time = res[ko39].ht.split(":").map(Number);
                    let timeA = res[ko39].tt.split(":").map(Number);
                    let nowH = new Date().getHours();
                    let nowM = new Date().getMinutes();
                    if (time[0] < 4) time[0] = time[0] + 24;
                    if (timeA[0] < 4) timeA[0] = timeA[0] + 24;
                    if (nowH < 4) nowH = Number(nowH) + 24;
                    let diaTime = time;
                    let diaTimeA = timeA;
                    time[1] += trainData.del;
                    timeA[1] += trainData.del;
                    if (time[1] >= 60) {
                        time[1] %= 60;
                        time[0] += Math.floor(time[1] / 60);
                    }
                    if (timeA[1] >= 60) {
                        timeA[1] %= 60;
                        timeA[0] += Math.floor(timeA[1] / 60);
                    }
                    if (time[0] > nowH || (time[0] == nowH && time[1] >= nowM))
                    yield {
                        num: `${trainData.num}`,
                        dir: `${trainData.dir ? "下り" : "上り"}`,
                        trn: trainData.trn == trainData.trn2 ? trainData.trn : `${trainData.trn}(${trainData.trn2})`,
                        st: trainData.st,
                        car: `${trainData.car}`,
                        del: `${trainData.del}`,
                        ser: trainData.ser,
                        pos: `${positionData}`,
                        tt: `${String(timeA[0]).padStart(2, '0')}:${String(timeA[1]).padStart(2, '0')}`,
                        ttd: `${String(diaTimeA[0]).padStart(2, '0')}:${String(diaTimeA[1]).padStart(2, '0')}`,
                        ht: `${String(time[0]).padStart(2, '0')}:${String(time[1]).padStart(2, '0')}`,
                        htd: `${String(diaTime[0]).padStart(2, '0')}:${String(diaTime[1]).padStart(2, '0')}`,
                        cr: ``,
                        dh: diaTime[0],
                        dm: diaTime[1]
                    };
                    /*
                        num: `${trainData.num}レ`,
                        dir: `${trainData.dir ? "下り" : "上り"}`,
                        trn: trainData.trn == trainData.trn2 ? trainData.trn : `${trainData.trn}(${trainData.trn2})`,
                        st: trainData.st,
                        car: `${trainData.car}両編成`,
                        del: `遅れ${trainData.del}分`,
                        ser: trainData.ser,
                        pos: `現在位置 ${positionData}`,
                        tt: `若葉台駅到着予定時刻 ${timeA[0]}時${timeA[1]}分`,遅延分数込
                        ttd: `若葉台駅到着予定時刻 ${diatimeA[0]}時${diatimeA[1]}分`,
                        ht: `若葉台駅発車予想時刻 ${time[0]}時${time[1]}分`,遅延分数込
                        htd: `若葉台駅発車予定時刻 ${diaTime[0]}時${diaTime[1]}分`,
                        cr: `混雑度 ？？？`
                    */
                    else yield null;
                } else yield null; else yield null;
            } catch (er) {
                console.error(er);
            }
        }
    }
    for (const item of allTrainData) {
        for await (const trainData of deleteTrain(item)) {
            if (trainData != null) trainList[trainList.length] = trainData;
        }
    }
    trainList.sort((a, b) => a.dh != b.dh ? a.dh - b.dh : a.dm - b.dm);
    console.log(trainList);
    displayData();
}

function displayData() {
    if (trainList.length) {
        document.getElementById("down").innerHTML = ``;
        document.getElementById("up").innerHTML = ``;
        trainList.forEach(t => {
            let displayE;
            if (Number(t.del)) displayE = `<div id="${t.num}"><span>${t.htd}</span> <span class="delay">+${t.del}</span>　<span>${t.trn}</span> <span>${t.st}</span> <span>${t.car}両編成</span><br>現在位置 <span>${t.pos}</span></div><br>`; else displayE = `<div id="${t.num}"><span>${t.htd}</span>　<span>${t.trn}</span> <span>${t.st}</span> <span>${t.car}両編成</span><br>現在位置 <span>${t.pos}</span></div><br>`;
            /*　例
                　12:34 +3分　区間急行 京王線新宿行 10両編成
                　現在位置 京王永山～若葉台駅間
            */
            if (t.dir == "下り") document.getElementById("down").innerHTML += displayE; else if (t.dir == "上り") document.getElementById("up").innerHTML += displayE;
            document.getElementById("displayStatus").innerText = "";
        });
    } else console.error('"trainData" does not contain any data.');
}
