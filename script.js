/* =========================================================
   BRAWL TOURNAMENTS
   SCRIPT.JS
   ========================================================= */

"use strict";


/* =========================================================
   STORAGE
========================================================= */

const STORAGE_KEY = "brawl_tournaments_v1";


const defaultState = {
    teams: [],
    league: null,
    groups: null,
    knockout: null,
    history: [],
    draws: 0
};


let state = loadState();


function loadState() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);

        if (!saved) {
            return structuredClone(defaultState);
        }

        const parsed = JSON.parse(saved);

        return {
            ...structuredClone(defaultState),
            ...parsed
        };

    } catch (error) {

        console.error(error);

        return structuredClone(defaultState);
    }
}


function saveState() {

    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(state)
    );

    updateDashboard();
}


/* =========================================================
   HELPERS
========================================================= */

function uid(prefix = "id") {

    return (
        prefix +
        "_" +
        Date.now().toString(36) +
        "_" +
        Math.random()
            .toString(36)
            .substring(2, 8)
    );
}


function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
}


function shuffle(array) {

    const arr = [...array];

    for (let i = arr.length - 1; i > 0; i--) {

        const j = Math.floor(
            Math.random() * (i + 1)
        );

        [arr[i], arr[j]] =
            [arr[j], arr[i]];
    }

    return arr;
}


function escapeHTML(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function getTeam(id) {

    return state.teams.find(
        team => team.id === id
    );
}


function teamName(id) {

    const team = getTeam(id);

    return team ? team.name : "فريق محذوف";
}


function teamInitial(id) {

    const name = teamName(id);

    return name.trim().charAt(0).toUpperCase() || "?";
}


function formatDate(date) {

    try {

        return new Date(date).toLocaleDateString(
            "ar-LY",
            {
                day: "numeric",
                month: "short",
                year: "numeric"
            }
        );

    } catch {

        return "";
    }
}


function totalMatchesFromRounds(rounds = []) {

    return rounds.reduce(
        (total, round) =>
            total + (round.matches?.length || 0),
        0
    );
}


function completedMatchesFromRounds(rounds = []) {

    return rounds.reduce(
        (total, round) =>
            total +
            (round.matches || []).filter(
                match => match.played
            ).length,
        0
    );
}


function isPowerOfTwo(number) {

    return (
        number >= 2 &&
        (number & (number - 1)) === 0
    );
}


/* =========================================================
   TOAST
========================================================= */

function showToast(
    message,
    type = "success",
    icon = null
) {

    const container =
        document.getElementById(
            "toastContainer"
        );

    const toast =
        document.createElement("div");

    toast.className =
        `toast ${type}`;

    const icons = {
        success: "✓",
        error: "!",
        info: "ℹ️"
    };

    toast.innerHTML = `
        <span class="toast-icon">
            ${icon || icons[type] || "•"}
        </span>

        <span>
            ${escapeHTML(message)}
        </span>
    `;

    container.appendChild(toast);

    setTimeout(() => {

        toast.style.opacity = "0";
        toast.style.transform =
            "translateY(10px)";

        setTimeout(
            () => toast.remove(),
            250
        );

    }, 2800);
}


/* =========================================================
   DRAW ANIMATION
========================================================= */

function runDraw(callback) {

    const overlay =
        document.createElement("div");

    overlay.className =
        "draw-overlay";

    overlay.innerHTML = `
        <div class="draw-box">

            <div class="draw-dice">
                🎲
            </div>

            <h2>
                جاري إجراء القرعة...
            </h2>

            <p>
                يتم توزيع الفرق عشوائياً
            </p>

        </div>
    `;

    document.body.appendChild(overlay);

    setTimeout(() => {

        overlay.remove();

        state.draws++;

        callback();

        saveState();

    }, 900);
}


/* =========================================================
   NAVIGATION
========================================================= */

function showPage(page) {

    document
        .querySelectorAll(".page")
        .forEach(section => {

            section.classList.toggle(
                "active",
                section.id === `page-${page}`
            );

        });


    document
        .querySelectorAll(
            ".nav-item, .mobile-nav-item"
        )
        .forEach(button => {

            button.classList.toggle(
                "active",
                button.dataset.page === page
            );

        });


    document
        .getElementById("sidebar")
        ?.classList.remove("open");


    if (page === "league") {
        renderLeague();
    }

    if (page === "groups") {
        renderGroups();
    }

    if (page === "knockout") {
        renderKnockout();
    }

    if (page === "teams") {
        renderGlobalTeams();
    }

    if (page === "history") {
        renderHistory();
    }

    updateDashboard();

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}


document.addEventListener(
    "click",
    event => {

        const button =
            event.target.closest(
                "[data-page]"
            );

        if (!button) return;

        showPage(button.dataset.page);
    }
);


/* =========================================================
   MOBILE MENU
========================================================= */

document
    .getElementById("mobileMenuBtn")
    ?.addEventListener(
        "click",
        () => {

            document
                .getElementById("sidebar")
                .classList.toggle("open");

        }
    );


document
    .getElementById("mobileMoreBtn")
    ?.addEventListener(
        "click",
        () => {

            showPage("history");

        }
    );


/* =========================================================
   GLOBAL TEAM MANAGER
========================================================= */

function addGlobalTeam(name) {

    name = name.trim();

    if (!name) {

        showToast(
            "اكتب اسم الفريق أولاً",
            "error"
        );

        return false;
    }


    if (
        state.teams.some(
            team =>
                team.name.toLowerCase() ===
                name.toLowerCase()
        )
    ) {

        showToast(
            "هذا الفريق موجود بالفعل",
            "error"
        );

        return false;
    }


    state.teams.push({

        id: uid("team"),

        name,

        players: [],

        createdAt:
            new Date().toISOString()

    });


    saveState();

    renderGlobalTeams();

    renderAllTeamLists();

    showToast(
        `تمت إضافة ${name}`,
        "success"
    );

    return true;
}


document
    .getElementById("addGlobalTeamBtn")
    ?.addEventListener(
        "click",
        () => {

            const input =
                document.getElementById(
                    "globalTeamInput"
                );

            if (
                addGlobalTeam(input.value)
            ) {

                input.value = "";

                input.focus();
            }
        }
    );


document
    .getElementById("globalTeamInput")
    ?.addEventListener(
        "keydown",
        event => {

            if (event.key === "Enter") {

                document
                    .getElementById(
                        "addGlobalTeamBtn"
                    )
                    .click();
            }
        }
    );


document
    .getElementById("quickAddTeamBtn")
    ?.addEventListener(
        "click",
        () => {

            document
                .getElementById(
                    "globalTeamInput"
                )
                ?.focus();

        }
    );


function renderGlobalTeams() {

    const list =
        document.getElementById(
            "globalTeamList"
        );

    const count =
        document.getElementById(
            "globalTeamCount"
        );

    if (!list) return;


    count.textContent =
        `${state.teams.length} فريق`;


    if (!state.teams.length) {

        list.innerHTML = `
            <div class="empty-state"
                 style="grid-column:1/-1">

                <div>👥</div>

                <strong>
                    لا توجد فرق
                </strong>

                <span>
                    أضف أول فريق للبدء.
                </span>

            </div>
        `;

        return;
    }


    list.innerHTML =
        state.teams
            .map((team, index) => `

                <div
                    class="global-team-card"
                    data-team-card="${team.id}">

                    <div class="global-team-avatar">
                        ${escapeHTML(
                            team.name
                                .trim()
                                .charAt(0)
                                .toUpperCase()
                        )}
                    </div>

                    <div class="global-team-info">

                        <strong>
                            ${escapeHTML(team.name)}
                        </strong>

                        <small>
                            فريق #${index + 1}
                        </small>

                    </div>

                    <button
                        class="delete-global-team"
                        data-delete-global-team="${team.id}"
                        title="حذف">

                        ×

                    </button>

                </div>

            `)
            .join("");
}


document.addEventListener(
    "click",
    event => {

        const button =
            event.target.closest(
                "[data-delete-global-team]"
            );

        if (!button) return;

        const id =
            button.dataset.deleteGlobalTeam;

        const team =
            getTeam(id);

        if (!team) return;


        const used =
            teamUsedAnywhere(id);

        if (used) {

            showToast(
                "لا يمكن حذف فريق مستخدم في بطولة حالية",
                "error"
            );

            return;
        }


        state.teams =
            state.teams.filter(
                item => item.id !== id
            );

        saveState();

        renderGlobalTeams();

        renderAllTeamLists();

        showToast(
            "تم حذف الفريق",
            "success"
        );
    }
);


function teamUsedAnywhere(id) {

    const collections = [];

    if (state.league) {
        collections.push(
            state.league.teams
        );
    }

    if (state.groups) {
        collections.push(
            state.groups.teams
        );
    }

    if (state.knockout) {
        collections.push(
            state.knockout.teams
        );
    }


    return collections.some(
        teams =>
            (teams || []).some(
                team =>
                    typeof team === "string"
                        ? team === id
                        : team.id === id
            )
    );
}


/* =========================================================
   TEMP TEAM LISTS
========================================================= */

const tempTeams = {
    league: [],
    groups: [],
    knockout: []
};


function addTempTeam(type, inputId) {

    const input =
        document.getElementById(inputId);

    if (!input) return;


    const name =
        input.value.trim();

    if (!name) {

        showToast(
            "اكتب اسم الفريق أولاً",
            "error"
        );

        return;
    }


    if (
        tempTeams[type].some(
            id =>
                teamName(id).toLowerCase() ===
                name.toLowerCase()
        )
    ) {

        showToast(
            "الفريق مضاف بالفعل",
            "error"
        );

        return;
    }


    let existing =
        state.teams.find(
            team =>
                team.name.toLowerCase() ===
                name.toLowerCase()
        );


    if (!existing) {

        existing = {

            id: uid("team"),

            name,

            players: [],

            createdAt:
                new Date().toISOString()

        };

        state.teams.push(existing);
    }


    tempTeams[type].push(existing.id);

    input.value = "";

    renderTempTeamList(type);

    saveState();

    input.focus();
}


function removeTempTeam(type, id) {

    tempTeams[type] =
        tempTeams[type].filter(
            teamId =>
                teamId !== id
        );

    renderTempTeamList(type);
}


function renderTempTeamList(type) {

    const config = {

        league: {
            list: "leagueTeamList",
            counter: "leagueTeamCounter"
        },

        groups: {
            list: "groupTeamList",
            counter: "groupsTeamCounter"
        },

        knockout: {
            list: "knockoutTeamList",
            counter: "knockoutTeamCounter"
        }

    }[type];


    const list =
        document.getElementById(
            config.list
        );

    const counter =
        document.getElementById(
            config.counter
        );


    if (!list) return;


    counter.textContent =
        `${tempTeams[type].length} فرق`;


    list.innerHTML =
        tempTeams[type]
            .map((id, index) => `

                <div class="team-chip">

                    <span class="team-chip-number">
                        ${index + 1}
                    </span>

                    <span>
                        ${escapeHTML(teamName(id))}
                    </span>

                    <button
                        class="remove-team"
                        data-remove-temp="${type}"
                        data-team-id="${id}">

                        ×

                    </button>

                </div>

            `)
            .join("");
}


function renderAllTeamLists() {

    ["league", "groups", "knockout"]
        .forEach(renderTempTeamList);
}


document.addEventListener(
    "click",
    event => {

        const button =
            event.target.closest(
                "[data-remove-temp]"
            );

        if (!button) return;

        removeTempTeam(
            button.dataset.removeTemp,
            button.dataset.teamId
        );
    }
);


/* =========================================================
   LEAGUE
========================================================= */

document
    .getElementById("addLeagueTeamBtn")
    ?.addEventListener(
        "click",
        () =>
            addTempTeam(
                "league",
                "leagueTeamInput"
            )
    );


document
    .getElementById("leagueTeamInput")
    ?.addEventListener(
        "keydown",
        event => {

            if (event.key === "Enter") {

                document
                    .getElementById(
                        "addLeagueTeamBtn"
                    )
                    .click();
            }
        }
    );


document
    .getElementById("newLeagueBtn")
    ?.addEventListener(
        "click",
        () => {

            state.league = null;

            tempTeams.league = [];

            document
                .getElementById(
                    "leagueSetup"
                )
                .classList.remove("hidden");

            document
                .getElementById(
                    "leagueBoard"
                )
                .classList.add("hidden");

            renderTempTeamList("league");
        }
    );


function generateLeagueRounds(
    teamIds,
    doubleRound = false
) {

    let teams = [...teamIds];

    if (teams.length < 2) {
        return [];
    }


    if (teams.length % 2 !== 0) {
        teams.push(null);
    }


    const n = teams.length;

    const firstRounds = [];

    let rotation = [...teams];


    for (
        let roundIndex = 0;
        roundIndex < n - 1;
        roundIndex++
    ) {

        const matches = [];


        for (
            let i = 0;
            i < n / 2;
            i++
        ) {

            let a = rotation[i];

            let b =
                rotation[n - 1 - i];


            if (!a || !b) continue;


            if (
                (roundIndex + i) % 2 === 0
            ) {

                [a, b] = [b, a];

            }


            matches.push({

                id: uid("match"),

                team1: a,

                team2: b,

                played: false,

                result: null,

                score1: null,

                score2: null

            });
        }


        firstRounds.push({

            number:
                roundIndex + 1,

            matches

        });


        rotation = [

            rotation[0],

            rotation[n - 1],

            ...rotation.slice(
                1,
                n - 1
            )

        ];
    }


    if (!doubleRound) {
        return firstRounds;
    }


    const secondRounds =
        firstRounds.map(
            (round, index) => ({

                number:
                    firstRounds.length +
                    index +
                    1,

                matches:
                    round.matches.map(
                        match => ({

                            id: uid("match"),

                            team1:
                                match.team2,

                            team2:
                                match.team1,

                            played: false,

                            result: null,

                            score1: null,

                            score2: null

                        })
                    )

            })
        );


    return [
        ...firstRounds,
        ...secondRounds
    ];
}


document
    .getElementById("startLeagueBtn")
    ?.addEventListener(
        "click",
        () => {

            const teams =
                [...tempTeams.league];

            if (teams.length < 2) {

                showToast(
                    "أضف فريقين على الأقل",
                    "error"
                );

                return;
            }


            const name =
                document
                    .getElementById(
                        "leagueName"
                    )
                    .value.trim() ||
                "Brawl League";


            const doubleRound =
                document
                    .getElementById(
                        "leagueFormat"
                    )
                    .value === "double";


            runDraw(() => {

                if (state.league) {

                    addToHistory(
                        state.league
                    );
                }


                state.league = {

                    id: uid("league"),

                    type: "league",

                    name,

                    teams,

                    doubleRound,

                    winPoints: 3,

                    drawPoints: 1,

                    lossPoints: 0,

                    rounds:
                        generateLeagueRounds(
                            teams,
                            doubleRound
                        ),

                    createdAt:
                        new Date().toISOString(),

                    champion: null

                };


                document
                    .getElementById(
                        "leagueSetup"
                    )
                    .classList.add("hidden");

                document
                    .getElementById(
                        "leagueBoard"
                    )
                    .classList.remove("hidden");

                renderLeague();

                showToast(
                    "تم إنشاء الدوري بنجاح",
                    "success",
                    "🏆"
                );
            });
        }
    );


document
    .getElementById("leagueResetBtn")
    ?.addEventListener(
        "click",
        () => {

            if (!state.league) return;

            tempTeams.league =
                [...state.league.teams];

            document
                .getElementById(
                    "leagueSetup"
                )
                .classList.remove("hidden");

            document
                .getElementById(
                    "leagueBoard"
                )
                .classList.add("hidden");

            renderTempTeamList("league");
        }
    );


function calculateLeagueTable(
    tournament
) {

    const table = {};

    tournament.teams.forEach(id => {

        table[id] = {

            id,

            played: 0,

            wins: 0,

            draws: 0,

            losses: 0,

            for: 0,

            against: 0,

            points: 0

        };

    });


    tournament.rounds.forEach(
        round => {

            round.matches.forEach(
                match => {

                    if (!match.played) {
                        return;
                    }


                    const a =
                        table[match.team1];

                    const b =
                        table[match.team2];


                    if (!a || !b) return;


                    a.played++;
                    b.played++;


                    const score1 =
                        Number(
                            match.score1
                        ) || 0;

                    const score2 =
                        Number(
                            match.score2
                        ) || 0;


                    a.for += score1;
                    a.against += score2;

                    b.for += score2;
                    b.against += score1;


                    if (
                        match.result === "draw"
                    ) {

                        a.draws++;
                        b.draws++;

                        a.points +=
                            tournament.drawPoints;

                        b.points +=
                            tournament.drawPoints;

                    }

                    else if (
                        match.result === "team1"
                    ) {

                        a.wins++;
                        b.losses++;

                        a.points +=
                            tournament.winPoints;

                    }

                    else if (
                        match.result === "team2"
                    ) {

                        b.wins++;
                        a.losses++;

                        b.points +=
                            tournament.winPoints;
                    }

                }
            );

        }
    );


    return Object.values(table)
        .sort((a, b) => {

            if (
                b.points !== a.points
            ) {
                return b.points - a.points;
            }


            const diffA =
                a.for - a.against;

            const diffB =
                b.for - b.against;


            if (diffB !== diffA) {
                return diffB - diffA;
            }


            return b.for - a.for;
        });
}


function renderLeague() {

    const setup =
        document.getElementById(
            "leagueSetup"
        );

    const board =
        document.getElementById(
            "leagueBoard"
        );


    if (!state.league) {

        setup.classList.remove("hidden");
        board.classList.add("hidden");

        renderTempTeamList("league");

        return;
    }


    setup.classList.add("hidden");
    board.classList.remove("hidden");


    const tournament =
        state.league;


    document
        .getElementById(
            "leagueBoardTitle"
        )
        .textContent =
        tournament.name;


    const total =
        totalMatchesFromRounds(
            tournament.rounds
        );

    const completed =
        completedMatchesFromRounds(
            tournament.rounds
        );


    document
        .getElementById(
            "leagueMatchCount"
        )
        .textContent = total;


    document
        .getElementById(
            "leaguePlayedCount"
        )
        .textContent = completed;


    document
        .getElementById(
            "leagueProgress"
        )
        .textContent =
        `${completed} من ${total} مباراة مكتملة`;


    const table =
        calculateLeagueTable(
            tournament
        );


    document
        .getElementById(
            "leagueLeader"
        )
        .textContent =
        table.length
            ? teamName(table[0].id)
            : "—";


    renderLeagueRounds();
    renderLeagueTable();
}


function renderLeagueRounds() {

    const container =
        document.getElementById(
            "leagueRounds"
        );

    const tournament =
        state.league;


    container.innerHTML =
        tournament.rounds
            .map(
                (round, roundIndex) => `

                    <div class="round-card">

                        <div class="round-header">

                            <strong>
                                الجولة ${round.number}
                            </strong>

                            <span>
                                ${
                                    round.matches.filter(
                                        match =>
                                            match.played
                                    ).length
                                }
                                /
                                ${round.matches.length}
                                مكتملة
                            </span>

                        </div>

                        <div class="match-list">

                            ${round.matches
                                .map(
                                    (
                                        match,
                                        matchIndex
                                    ) =>
                                        renderMatchRow(
                                            match,
                                            "league",
                                            roundIndex,
                                            matchIndex
                                        )
                                )
                                .join("")}

                        </div>

                    </div>

                `
            )
            .join("");
}


function renderMatchRow(
    match,
    type,
    roundIndex,
    matchIndex
) {

    const resultText =
        !match.played
            ? "لم تلعب"
            : match.result === "team1"
                ? `فوز ${teamName(match.team1)}`
                : match.result === "team2"
                    ? `فوز ${teamName(match.team2)}`
                    : "تعادل";


    const score =
        match.played &&
        (
            match.score1 !== null ||
            match.score2 !== null
        )
            ? `${match.score1 ?? 0} - ${match.score2 ?? 0}`
            : "";


    return `

        <div class="match-row">

            <div class="match-team home">

                <div class="team-avatar">
                    ${escapeHTML(
                        teamInitial(
                            match.team1
                        )
                    )}
                </div>

                <span>
                    ${escapeHTML(
                        teamName(
                            match.team1
                        )
                    )}
                </span>

            </div>


            <div class="match-center">

                <span class="match-vs">
                    ${score || "VS"}
                </span>

                <span
                    class="result-badge ${
                        match.played
                            ? "completed"
                            : ""
                    }">

                    ${
                        match.played
                            ? escapeHTML(
                                resultText
                            )
                            : "مباراة قادمة"
                    }

                </span>

                <button
                    class="match-action"
                    data-open-match="true"
                    data-match-type="${type}"
                    data-round="${roundIndex}"
                    data-index="${matchIndex}">

                    ${
                        match.played
                            ? "تعديل النتيجة"
                            : "تسجيل النتيجة"
                    }

                </button>

            </div>


            <div class="match-team away">

                <span>
                    ${escapeHTML(
                        teamName(
                            match.team2
                        )
                    )}
                </span>

                <div class="team-avatar">
                    ${escapeHTML(
                        teamInitial(
                            match.team2
                        )
                    )}
                </div>

            </div>

        </div>

    `;
}


function renderLeagueTable() {

    const tbody =
        document.getElementById(
            "leagueTableBody"
        );

    const table =
        calculateLeagueTable(
            state.league
        );


    tbody.innerHTML =
        table
            .map(
                (row, index) => `

                    <tr>

                        <td>

                            <span
                                class="rank-number ${
                                    index < 3
                                        ? "top"
                                        : ""
                                }">

                                ${index + 1}

                            </span>

                        </td>

                        <td>
                            ${escapeHTML(
                                teamName(
                                    row.id
                                )
                            )}
                        </td>

                        <td>
                            ${row.played}
                        </td>

                        <td>
                            ${row.wins}
                        </td>

                        <td>
                            ${row.draws}
                        </td>

                        <td>
                            ${row.losses}
                        </td>

                        <td>
                            ${row.for}
                        </td>

                        <td>
                            ${row.against}
                        </td>

                        <td>
                            ${
                                row.for -
                                row.against
                            }
                        </td>

                        <td
                            class="points-cell">

                            ${row.points}

                        </td>

                    </tr>

                `
            )
            .join("");
}


/* =========================================================
   GROUP STAGE
========================================================= */

document
    .getElementById("addGroupTeamBtn")
    ?.addEventListener(
        "click",
        () =>
            addTempTeam(
                "groups",
                "groupTeamInput"
            )
    );


document
    .getElementById("groupTeamInput")
    ?.addEventListener(
        "keydown",
        event => {

            if (event.key === "Enter") {

                document
                    .getElementById(
                        "addGroupTeamBtn"
                    )
                    .click();
            }
        }
    );


function createGroups(
    teamIds,
    groupCount,
    qualifiersPerGroup
) {

    const shuffled =
        shuffle(teamIds);

    const groups = [];


    for (
        let i = 0;
        i < groupCount;
        i++
    ) {

        groups.push({

            id: String.fromCharCode(
                65 + i
            ),

            name:
                `المجموعة ${String.fromCharCode(
                    65 + i
                )}`,

            teamIds: [],

            qualifiers:
                qualifiersPerGroup,

            rounds: []

        });
    }


    shuffled.forEach(
        (teamId, index) => {

            groups[
                index % groupCount
            ]
                .teamIds
                .push(teamId);

        }
    );


    groups.forEach(group => {

        group.rounds =
            generateLeagueRounds(
                group.teamIds,
                false
            );

    });


    return groups;
}


document
    .getElementById("drawGroupsBtn")
    ?.addEventListener(
        "click",
        () => {

            const teams =
                [...tempTeams.groups];


            const groupCount =
                Number(
                    document.getElementById(
                        "groupCount"
                    ).value
                );


            const qualifiers =
                Number(
                    document.getElementById(
                        "qualifiersPerGroup"
                    ).value
                );


            if (
                teams.length <
                groupCount * 2
            ) {

                showToast(
                    `تحتاج على الأقل ${groupCount * 2} فرق`,
                    "error"
                );

                return;
            }


            if (
                teams.length % groupCount !==
                0
            ) {

                showToast(
                    "عدد الفرق يجب أن يتوزع بالتساوي على المجموعات",
                    "error"
                );

                return;
            }


            const teamsPerGroup =
                teams.length / groupCount;


            if (
                qualifiers >=
                teamsPerGroup
            ) {

                showToast(
                    "عدد المتأهلين يجب أن يكون أقل من عدد فرق المجموعة",
                    "error"
                );

                return;
            }


            const name =
                document
                    .getElementById(
                        "groupsName"
                    )
                    .value.trim() ||
                "Brawl Champions";


            runDraw(() => {

                if (state.groups) {
                    addToHistory(
                        state.groups
                    );
                }


                state.groups = {

                    id: uid("groups"),

                    type: "groups",

                    name,

                    teams,

                    groupCount,

                    qualifiersPerGroup:
                        qualifiers,

                    groups:
                        createGroups(
                            teams,
                            groupCount,
                            qualifiers
                        ),

                    createdAt:
                        new Date().toISOString(),

                    champion: null

                };


                document
                    .getElementById(
                        "groupsSetup"
                    )
                    .classList.add(
                        "hidden"
                    );

                document
                    .getElementById(
                        "groupsBoard"
                    )
                    .classList.remove(
                        "hidden"
                    );


                renderGroups();

                showToast(
                    "تم إجراء قرعة المجموعات",
                    "success",
                    "🎲"
                );
            });
        }
    );


function calculateGroupTable(group) {

    const table = {};

    group.teamIds.forEach(id => {

        table[id] = {

            id,

            played: 0,

            wins: 0,

            draws: 0,

            losses: 0,

            for: 0,

            against: 0,

            points: 0

        };

    });


    group.rounds.forEach(
        round => {

            round.matches.forEach(
                match => {

                    if (!match.played) {
                        return;
                    }


                    const a =
                        table[match.team1];

                    const b =
                        table[match.team2];


                    if (!a || !b) return;


                    a.played++;
                    b.played++;


                    const score1 =
                        Number(
                            match.score1
                        ) || 0;

                    const score2 =
                        Number(
                            match.score2
                        ) || 0;


                    a.for += score1;
                    a.against += score2;

                    b.for += score2;
                    b.against += score1;


                    if (
                        match.result === "draw"
                    ) {

                        a.draws++;
                        b.draws++;

                        a.points++;
                        b.points++;

                    }

                    else if (
                        match.result === "team1"
                    ) {

                        a.wins++;

                        b.losses++;

                        a.points += 3;

                    }

                    else if (
                        match.result === "team2"
                    ) {

                        b.wins++;

                        a.losses++;

                        b.points += 3;
                    }

                }
            );

        }
    );


    return Object.values(table)
        .sort((a, b) => {

            if (
                b.points !== a.points
            ) {

                return (
                    b.points -
                    a.points
                );
            }


            const diffA =
                a.for - a.against;

            const diffB =
                b.for - b.against;


            if (diffB !== diffA) {
                return diffB - diffA;
            }


            return b.for - a.for;
        });
}


function groupAllMatchesPlayed(
    group
) {

    return (
        completedMatchesFromRounds(
            group.rounds
        ) ===
        totalMatchesFromRounds(
            group.rounds
        )
    );
}


function allGroupsComplete() {

    if (!state.groups) return false;

    return state.groups.groups.every(
        group =>
            groupAllMatchesPlayed(
                group
            )
    );
}


function getQualifiedTeams() {

    if (!state.groups) return [];

    const qualified = [];


    state.groups.groups.forEach(
        group => {

            const table =
                calculateGroupTable(
                    group
                );


            table
                .slice(
                    0,
                    state.groups
                        .qualifiersPerGroup
                )
                .forEach(
                    (row, index) => {

                        qualified.push({

                            id: row.id,

                            group:
                                group.id,

                            rank:
                                index + 1

                        });

                    }
                );

        }
    );


    return qualified;
}


function renderGroups() {

    const setup =
        document.getElementById(
            "groupsSetup"
        );

    const board =
        document.getElementById(
            "groupsBoard"
        );


    if (!state.groups) {

        setup.classList.remove(
            "hidden"
        );

        board.classList.add(
            "hidden"
        );

        renderTempTeamList(
            "groups"
        );

        updateGroupRequirement();

        return;
    }


    setup.classList.add(
        "hidden"
    );

    board.classList.remove(
        "hidden"
    );


    document
        .getElementById(
            "groupsBoardTitle"
        )
        .textContent =
        state.groups.name;


    const completed =
        state.groups.groups.reduce(
            (sum, group) =>
                sum +
                completedMatchesFromRounds(
                    group.rounds
                ),
            0
        );


    const total =
        state.groups.groups.reduce(
            (sum, group) =>
                sum +
                totalMatchesFromRounds(
                    group.rounds
                ),
            0
        );


    document
        .getElementById(
            "groupsProgress"
        )
        .textContent =
        `${completed} من ${total} مباراة مكتملة`;


    const container =
        document.getElementById(
            "groupsContainer"
        );


    container.innerHTML =
        state.groups.groups
            .map(
                group =>
                    renderGroupCard(
                        group
                    )
            )
            .join("");


    const qualified =
        getQualifiedTeams();


    const panel =
        document.getElementById(
            "qualifiedPanel"
        );


    if (
        allGroupsComplete()
    ) {

        panel.classList.remove(
            "hidden"
        );

        document
            .getElementById(
                "groupsKnockoutBtn"
            )
            .disabled = false;

        document
            .getElementById(
                "qualifiedList"
            )
            .innerHTML =
            qualified
                .map(
                    item => `

                        <div class="qualified-team">

                            <span>
                                ${escapeHTML(
                                    teamName(
                                        item.id
                                    )
                                )}
                            </span>

                            <small>
                                مجموعة ${item.group}
                                · ${item.rank === 1
                                    ? "المركز الأول"
                                    : "المركز الثاني"}
                            </small>

                        </div>

                    `
                )
                .join("");

    } else {

        panel.classList.add(
            "hidden"
        );

        document
            .getElementById(
                "groupsKnockoutBtn"
            )
            .disabled = true;
    }
}


function renderGroupCard(group) {

    const table =
        calculateGroupTable(
            group
        );


    const qualifiedCount =
        state.groups
            .qualifiersPerGroup;


    return `

        <div class="group-card">

            <div class="group-title">

                <div class="group-title-left">

                    <div class="group-letter">
                        ${escapeHTML(
                            group.id
                        )}
                    </div>

                    <div>

                        <strong>
                            ${escapeHTML(
                                group.name
                            )}
                        </strong>

                        <small>
                            ${group.teamIds.length}
                            فرق
                        </small>

                    </div>

                </div>

            </div>


            <div class="table-scroll">

                <table class="group-table">

                    <thead>

                        <tr>
                            <th>#</th>
                            <th>الفريق</th>
                            <th>ل</th>
                            <th>ف</th>
                            <th>ن</th>
                        </tr>

                    </thead>

                    <tbody>

                        ${table
                            .map(
                                (row, index) => `

                                    <tr class="${
                                        index <
                                        qualifiedCount
                                            ? "qualified-row"
                                            : ""
                                    }">

                                        <td>
                                            ${
                                                index + 1
                                            }
                                        </td>

                                        <td>

                                            ${
                                                index <
                                                qualifiedCount
                                                    ? `
                                                        <span
                                                            class="qualified-mark">
                                                        </span>
                                                      `
                                                    : ""
                                            }

                                            ${escapeHTML(
                                                teamName(
                                                    row.id
                                                )
                                            )}

                                        </td>

                                        <td>
                                            ${row.played}
                                        </td>

                                        <td>
                                            ${row.wins}
                                        </td>

                                        <td>
                                            ${row.points}
                                        </td>

                                    </tr>

                                `
                            )
                            .join("")}

                    </tbody>

                </table>

            </div>


            <div class="group-matches">

                <div class="group-matches-title">
                    مباريات المجموعة
                </div>

                ${group.rounds
                    .map(
                        (round, roundIndex) =>
                            round.matches
                                .map(
                                    (
                                        match,
                                        matchIndex
                                    ) => `

                                        <div class="group-match">

                                            <span>
                                                ${escapeHTML(
                                                    teamName(
                                                        match.team1
                                                    )
                                                )}
                                            </span>

                                            <span>
                                                ${
                                                    match.played
                                                        ? match.result ===
                                                          "team1"
                                                            ? "🏆"
                                                            : match.result ===
                                                              "team2"
                                                                ? "🏆"
                                                                : "🤝"
                                                        : "VS"
                                                }
                                            </span>

                                            <span>
                                                ${escapeHTML(
                                                    teamName(
                                                        match.team2
                                                    )
                                                )}
                                            </span>

                                            <button
                                                data-open-match="true"
                                                data-match-type="group"
                                                data-group-id="${group.id}"
                                                data-round="${roundIndex}"
                                                data-index="${matchIndex}">

                                                ${
                                                    match.played
                                                        ? "تعديل"
                                                        : "نتيجة"
                                                }

                                            </button>

                                        </div>

                                    `
                                )
                                .join("")
                    )
                    .join("")}

            </div>

        </div>

    `;
}


function updateGroupRequirement() {

    const count =
        tempTeams.groups.length;

    const groups =
        Number(
            document
                .getElementById(
                    "groupCount"
                )
                ?.value || 2
        );


    const element =
        document.getElementById(
            "groupRequirement"
        );


    if (!element) return;


    if (!count) {

        element.textContent =
            "أضف الفرق حتى يصبح العدد مناسباً للمجموعات.";

        return;
    }


    if (count % groups !== 0) {

        element.textContent =
            `${count} فريق حالياً — العدد غير قابل للتوزيع بالتساوي على ${groups} مجموعات.`;

        return;
    }


    element.textContent =
        `${count / groups} فرق في كل مجموعة — العدد مناسب للقرعة.`;
}


document
    .getElementById("groupCount")
    ?.addEventListener(
        "change",
        updateGroupRequirement
    );


/* =========================================================
   GROUP REDRAW
========================================================= */

document
    .getElementById("groupsRedrawBtn")
    ?.addEventListener(
        "click",
        () => {

            if (!state.groups) return;


            const teams =
                [...state.groups.teams];


            runDraw(() => {

                state.groups.groups =
                    createGroups(
                        teams,
                        state.groups.groupCount,
                        state.groups
                            .qualifiersPerGroup
                    );


                renderGroups();

                showToast(
                    "تمت إعادة القرعة",
                    "success",
                    "🎲"
                );
            });
        }
    );


/* =========================================================
   KNOCKOUT
========================================================= */

document
    .getElementById("addKnockoutTeamBtn")
    ?.addEventListener(
        "click",
        () =>
            addTempTeam(
                "knockout",
                "knockoutTeamInput"
            )
    );


document
    .getElementById("knockoutTeamInput")
    ?.addEventListener(
        "keydown",
        event => {

            if (event.key === "Enter") {

                document
                    .getElementById(
                        "addKnockoutTeamBtn"
                    )
                    .click();
            }
        }
    );


function generateKnockoutRound(
    teamIds
) {

    const shuffled =
        shuffle(teamIds);

    const matches = [];


    for (
        let i = 0;
        i < shuffled.length;
        i += 2
    ) {

        matches.push({

            id: uid("match"),

            team1:
                shuffled[i],

            team2:
                shuffled[i + 1],

            played: false,

            result: null,

            score1: null,

            score2: null

        });
    }


    return {

        number: 1,

        matches

    };
}


document
    .getElementById("drawKnockoutBtn")
    ?.addEventListener(
        "click",
        () => {

            const teams =
                [...tempTeams.knockout];


            if (
                !isPowerOfTwo(
                    teams.length
                )
            ) {

                showToast(
                    "عدد الفرق يجب أن يكون 2 أو 4 أو 8 أو 16 أو 32",
                    "error"
                );

                return;
            }


            const name =
                document
                    .getElementById(
                        "knockoutName"
                    )
                    .value.trim() ||
                "Brawl Cup";


            runDraw(() => {

                if (state.knockout) {
                    addToHistory(
                        state.knockout
                    );
                }


                state.knockout = {

                    id: uid("knockout"),

                    type: "knockout",

                    name,

                    teams,

                    rounds: [
                        generateKnockoutRound(
                            teams
                        )
                    ],

                    createdAt:
                        new Date().toISOString(),

                    champion: null,

                    seedInfo: {}

                };


                document
                    .getElementById(
                        "knockoutSetup"
                    )
                    .classList.add(
                        "hidden"
                    );

                document
                    .getElementById(
                        "knockoutBoard"
                    )
                    .classList.remove(
                        "hidden"
                    );


                renderKnockout();

                showToast(
                    "تم إجراء قرعة الأدوار الإقصائية",
                    "success",
                    "⚔️"
                );
            });
        }
    );


document
    .getElementById("knockoutRedrawBtn")
    ?.addEventListener(
        "click",
        () => {

            if (!state.knockout) return;


            const teams =
                [...state.knockout.teams];


            runDraw(() => {

                state.knockout.rounds = [
                    generateKnockoutRound(
                        teams
                    )
                ];

                state.knockout.champion =
                    null;

                renderKnockout();

                showToast(
                    "تمت إعادة القرعة",
                    "success",
                    "🎲"
                );
            });
        }
    );


function knockoutRoundName(
    roundIndex,
    totalRounds
) {

    const remaining =
        totalRounds -
        roundIndex;


    if (remaining === 1) {
        return "النهائي";
    }

    if (remaining === 2) {
        return "نصف النهائي";
    }

    if (remaining === 3) {
        return "ربع النهائي";
    }

    if (remaining === 4) {
        return "دور الـ16";
    }

    if (remaining === 5) {
        return "دور الـ32";
    }


    return `الدور ${roundIndex + 1}`;
}


function renderKnockout() {

    const setup =
        document.getElementById(
            "knockoutSetup"
        );

    const board =
        document.getElementById(
            "knockoutBoard"
        );


    if (!state.knockout) {

        setup.classList.remove(
            "hidden"
        );

        board.classList.add(
            "hidden"
        );

        renderTempTeamList(
            "knockout"
        );

        return;
    }


    setup.classList.add(
        "hidden"
    );

    board.classList.remove(
        "hidden"
    );


    const tournament =
        state.knockout;


    document
        .getElementById(
            "knockoutBoardTitle"
        )
        .textContent =
        tournament.name;


    const completed =
        completedMatchesFromRounds(
            tournament.rounds
        );

    const total =
        totalMatchesFromRounds(
            tournament.rounds
        );


    document
        .getElementById(
            "knockoutProgress"
        )
        .textContent =
        `${completed} مباراة مكتملة`;


    renderBracket();


    const championCard =
        document.getElementById(
            "championCard"
        );


    if (tournament.champion) {

        championCard.classList.remove(
            "hidden"
        );

        document
            .getElementById(
                "championName"
            )
            .textContent =
            teamName(
                tournament.champion
            );

    } else {

        championCard.classList.add(
            "hidden"
        );
    }
}


function renderBracket() {

    const container =
        document.getElementById(
            "knockoutBracket"
        );

    const tournament =
        state.knockout;


    const totalRounds =
        tournament.rounds.length;


    container.innerHTML = `

        <div class="bracket">

            ${tournament.rounds
                .map(
                    (round, roundIndex) => `

                        <div class="bracket-round">

                            <div class="bracket-round-title">

                                ${knockoutRoundName(
                                    roundIndex,
                                    totalRounds
                                )}

                            </div>

                            <div class="bracket-matches">

                                ${round.matches
                                    .map(
                                        (
                                            match,
                                            matchIndex
                                        ) =>
                                            renderBracketMatch(
                                                match,
                                                roundIndex,
                                                matchIndex
                                            )
                                    )
                                    .join("")}

                            </div>

                        </div>

                    `
                )
                .join("")}

        </div>

    `;
}


function renderBracketMatch(
    match,
    roundIndex,
    matchIndex
) {

    const team1 =
        match.team1
            ? teamName(match.team1)
            : "بانتظار المتأهل";


    const team2 =
        match.team2
            ? teamName(match.team2)
            : "بانتظار المتأهل";


    const team1Winner =
        match.played &&
        match.result === "team1";


    const team2Winner =
        match.played &&
        match.result === "team2";


    const canSelect =
        match.team1 &&
        match.team2 &&
        !match.played;


    return `

        <div class="bracket-match">

            <div class="bracket-team ${
                team1Winner
                    ? "winner"
                    : ""
            } ${
                !match.team1
                    ? "empty"
                    : ""
            }">

                <span>
                    ${escapeHTML(team1)}
                </span>

                ${
                    canSelect
                        ? `
                            <button
                                data-open-match="true"
                                data-match-type="knockout"
                                data-round="${roundIndex}"
                                data-index="${matchIndex}">

                                فوز

                            </button>
                          `
                        : ""
                }

            </div>


            <div class="bracket-team ${
                team2Winner
                    ? "winner"
                    : ""
            } ${
                !match.team2
                    ? "empty"
                    : ""
            }">

                <span>
                    ${escapeHTML(team2)}
                </span>

                ${
                    canSelect
                        ? `
                            <button
                                data-open-match="true"
                                data-match-type="knockout"
                                data-round="${roundIndex}"
                                data-index="${matchIndex}">

                                فوز

                            </button>
                          `
                        : ""
                }

            </div>

        </div>

    `;
}


function generateNextKnockoutRound() {

    const tournament =
        state.knockout;


    const lastRound =
        tournament.rounds[
            tournament.rounds.length - 1
        ];


    const winners =
        lastRound.matches
            .map(match => {

                if (
                    match.result ===
                    "team1"
                ) {
                    return match.team1;
                }

                if (
                    match.result ===
                    "team2"
                ) {
                    return match.team2;
                }

                return null;

            })
            .filter(Boolean);


    if (winners.length === 1) {

        tournament.champion =
            winners[0];

        showToast(
            `🏆 البطل: ${teamName(winners[0])}`,
            "success",
            "🏆"
        );

        return;
    }


    if (winners.length < 2) {
        return;
    }


    const matches = [];


    for (
        let i = 0;
        i < winners.length;
        i += 2
    ) {

        matches.push({

            id: uid("match"),

            team1:
                winners[i],

            team2:
                winners[i + 1],

            played: false,

            result: null,

            score1: null,

            score2: null

        });
    }


    tournament.rounds.push({

        number:
            tournament.rounds.length + 1,

        matches

    });


    showToast(
        "تم تأهل الفائزين للدور التالي",
        "success",
        "⚔️"
    );
}


/* =========================================================
   MATCH MODAL
========================================================= */

let currentMatchContext = null;


function openMatchModal(
    type,
    roundIndex,
    matchIndex,
    groupId = null
) {

    let match;


    if (type === "league") {

        match =
            state.league
                ?.rounds[
                    roundIndex
                ]
                ?.matches[
                    matchIndex
                ];

    }

    else if (type === "group") {

        const group =
            state.groups
                ?.groups
                .find(
                    item =>
                        item.id ===
                        groupId
                );

        match =
            group
                ?.rounds[
                    roundIndex
                ]
                ?.matches[
                    matchIndex
                ];

    }

    else if (type === "knockout") {

        match =
            state.knockout
                ?.rounds[
                    roundIndex
                ]
                ?.matches[
                    matchIndex
                ];

    }


    if (!match) return;


    currentMatchContext = {

        type,

        roundIndex,

        matchIndex,

        groupId

    };


    const modalContent =
        document.getElementById(
            "modalContent"
        );


    const isKnockout =
        type === "knockout";


    modalContent.innerHTML = `

        <div class="modal-title">
            ${
                isKnockout
                    ? "⚔️ اختيار الفائز"
                    : "🎮 تسجيل نتيجة المباراة"
            }
        </div>

        <div class="modal-subtitle">
            اختر النتيجة، ويمكنك إضافة نتيجة المابات اختيارياً.
        </div>


        <div class="modal-match">

            <div class="modal-team">

                <div class="modal-team-avatar">
                    ${escapeHTML(
                        teamInitial(
                            match.team1
                        )
                    )}
                </div>

                <strong>
                    ${escapeHTML(
                        teamName(
                            match.team1
                        )
                    )}
                </strong>

            </div>


            <div class="modal-vs">
                VS
            </div>


            <div class="modal-team">

                <div class="modal-team-avatar">
                    ${escapeHTML(
                        teamInitial(
                            match.team2
                        )
                    )}
                </div>

                <strong>
                    ${escapeHTML(
                        teamName(
                            match.team2
                        )
                    )}
                </strong>

            </div>

        </div>


        <div class="score-area">

            <div class="score-group">

                <label>
                    نتيجة ${escapeHTML(
                        teamName(
                            match.team1
                        )
                    )}
                </label>

                <input
                    class="score-input"
                    id="modalScore1"
                    type="number"
                    min="0"
                    max="99"
                    value="${
                        match.score1 ??
                        ""
                    }"
                    placeholder="—">

            </div>


            <div class="score-group">

                <label>
                    نتيجة ${escapeHTML(
                        teamName(
                            match.team2
                        )
                    )}
                </label>

                <input
                    class="score-input"
                    id="modalScore2"
                    type="number"
                    min="0"
                    max="99"
                    value="${
                        match.score2 ??
                        ""
                    }"
                    placeholder="—">

            </div>

        </div>


        <div class="result-buttons">

            <button
                class="result-choice win"
                data-modal-result="team1">

                🏆 فوز الأول

            </button>


            ${
                isKnockout
                    ? ""
                    : `
                        <button
                            class="result-choice draw"
                            data-modal-result="draw">

                            🤝 تعادل

                        </button>
                    `
            }


            <button
                class="result-choice loss"
                data-modal-result="team2">

                🏆 فوز الثاني

            </button>

        </div>


        ${
            match.played
                ? `
                    <button
                        class="secondary-btn modal-save"
                        data-modal-result="clear">

                        ↺ إلغاء النتيجة

                    </button>
                  `
                : ""
        }

    `;


    document
        .getElementById(
            "modalOverlay"
        )
        .classList.remove(
            "hidden"
        );
}


function closeModal() {

    document
        .getElementById(
            "modalOverlay"
        )
        .classList.add(
            "hidden"
        );

    currentMatchContext = null;
}


document
    .getElementById("modalClose")
    ?.addEventListener(
        "click",
        closeModal
    );


document
    .getElementById("modalOverlay")
    ?.addEventListener(
        "click",
        event => {

            if (
                event.target.id ===
                "modalOverlay"
            ) {

                closeModal();
            }
        }
    );


document.addEventListener(
    "click",
    event => {

        const button =
            event.target.closest(
                "[data-open-match]"
            );

        if (!button) return;


        openMatchModal(

            button.dataset.matchType,

            Number(
                button.dataset.round
            ),

            Number(
                button.dataset.index
            ),

            button.dataset.groupId ||
                null

        );
    }
);


/* =========================================================
   SAVE MATCH RESULT
========================================================= */

document.addEventListener(
    "click",
    event => {

        const button =
            event.target.closest(
                "[data-modal-result]"
            );

        if (!button) return;

        if (!currentMatchContext) {
            return;
        }


        const result =
            button.dataset.modalResult;


        const context =
            currentMatchContext;


        let match;


        if (
            context.type ===
            "league"
        ) {

            match =
                state.league
                    ?.rounds[
                        context.roundIndex
                    ]
                    ?.matches[
                        context.matchIndex
                    ];

        }

        else if (
            context.type ===
            "group"
        ) {

            const group =
                state.groups
                    ?.groups
                    .find(
                        item =>
                            item.id ===
                            context.groupId
                    );


            match =
                group
                    ?.rounds[
                        context.roundIndex
                    ]
                    ?.matches[
                        context.matchIndex
                    ];

        }

        else {

            match =
                state.knockout
                    ?.rounds[
                        context.roundIndex
                    ]
                    ?.matches[
                        context.matchIndex
                    ];
        }


        if (!match) {

            closeModal();

            return;
        }


        if (result === "clear") {

            match.played = false;

            match.result = null;

            match.score1 = null;

            match.score2 = null;


            saveState();

            closeModal();

            rerenderCurrentPage();

            showToast(
                "تم إلغاء نتيجة المباراة",
                "success"
            );

            return;
        }


        if (
            context.type ===
            "knockout" &&
            result === "draw"
        ) {

            return;
        }


        const score1Input =
            document.getElementById(
                "modalScore1"
            );

        const score2Input =
            document.getElementById(
                "modalScore2"
            );


        const score1 =
            score1Input.value === ""
                ? null
                : Number(
                    score1Input.value
                );


        const score2 =
            score2Input.value === ""
                ? null
                : Number(
                    score2Input.value
                );


        if (
            score1 !== null &&
            (
                !Number.isFinite(
                    score1
                ) ||
                score1 < 0
            )
        ) {

            showToast(
                "النتيجة الأولى غير صحيحة",
                "error"
            );

            return;
        }


        if (
            score2 !== null &&
            (
                !Number.isFinite(
                    score2
                ) ||
                score2 < 0
            )
        ) {

            showToast(
                "النتيجة الثانية غير صحيحة",
                "error"
            );

            return;
        }


        match.played = true;

        match.result = result;

        match.score1 = score1;

        match.score2 = score2;


        saveState();

        closeModal();


        if (
            context.type ===
            "knockout"
        ) {

            const round =
                state.knockout
                    .rounds[
                        context.roundIndex
                    ];


            const allDone =
                round.matches.every(
                    item =>
                        item.played
                );


            if (allDone) {

                generateNextKnockoutRound();
            }

        }


        rerenderCurrentPage();


        showToast(
            "تم حفظ نتيجة المباراة",
            "success",
            "✓"
        );
    }
);


/* =========================================================
   RERENDER
========================================================= */

function rerenderCurrentPage() {

    const active =
        document.querySelector(
            ".page.active"
        );


    if (!active) return;


    const id =
        active.id.replace(
            "page-",
            ""
        );


    if (id === "league") {
        renderLeague();
    }

    else if (id === "groups") {
        renderGroups();
    }

    else if (id === "knockout") {
        renderKnockout();
    }

    else if (id === "teams") {
        renderGlobalTeams();
    }

    else if (id === "history") {
        renderHistory();
    }


    updateDashboard();
}


/* =========================================================
   GROUP -> KNOCKOUT
========================================================= */

document
    .getElementById("groupsKnockoutBtn")
    ?.addEventListener(
        "click",
        () => {

            if (!state.groups) return;


            if (!allGroupsComplete()) {

                showToast(
                    "أكمل جميع مباريات المجموعات أولاً",
                    "error"
                );

                return;
            }


            const qualified =
                getQualifiedTeams();


            if (
                !isPowerOfTwo(
                    qualified.length
                )
            ) {

                showToast(
                    "عدد المتأهلين يجب أن يكون 2 أو 4 أو 8 أو 16 أو 32",
                    "error"
                );

                return;
            }


            const existing =
                state.knockout;


            if (existing) {

                addToHistory(
                    existing
                );
            }


            state.knockout = {

                id: uid("knockout"),

                type: "knockout",

                name:
                    `${state.groups.name} - الأدوار الإقصائية`,

                teams:
                    qualified.map(
                        item => item.id
                    ),

                rounds: [],

                createdAt:
                    new Date().toISOString(),

                champion: null,

                seedInfo: Object.fromEntries(
                    qualified.map(
                        item => [
                            item.id,
                            {
                                group:
                                    item.group,
                                rank:
                                    item.rank
                            }
                        ]
                    )
                )

            };


            const winners =
                qualified
                    .filter(
                        item =>
                            item.rank === 1
                    );

            const runners =
                qualified
                    .filter(
                        item =>
                            item.rank === 2
                    );


            let pairings = [];


            if (
                state.groups
                    .qualifiersPerGroup === 2
            ) {

                pairings =
                    drawCrossGroupPairings(
                        winners,
                        runners
                    );

            } else {

                pairings =
                    shuffle(
                        qualified
                    );
            }


            state.knockout.rounds = [

                {

                    number: 1,

                    matches:
                        pairings.map(
                            pair => ({

                                id: uid("match"),

                                team1:
                                    pair[0],

                                team2:
                                    pair[1],

                                played: false,

                                result: null,

                                score1: null,

                                score2: null

                            })
                        )

                }

            ];


            saveState();


            showPage("knockout");


            showToast(
                "تم نقل المتأهلين إلى الأدوار الإقصائية",
                "success",
                "⚔️"
            );
        }
    );


function drawCrossGroupPairings(
    winners,
    runners
) {

    const w =
        shuffle(winners);

    let r =
        shuffle(runners);


    for (
        let attempt = 0;
        attempt < 500;
        attempt++
    ) {

        r = shuffle(r);

        const pairs = [];

        let valid = true;


        for (
            let i = 0;
            i < w.length;
            i++
        ) {

            const winner =
                w[i];

            const runner =
                r[i];


            if (
                !runner ||
                winner.group ===
                runner.group
            ) {

                valid = false;

                break;
            }


            pairs.push([
                winner.id,
                runner.id
            ]);
        }


        if (valid) {
            return pairs;
        }
    }


    /* fallback */

    const pairs = [];


    for (
        let i = 0;
        i < w.length;
        i++
    ) {

        let runnerIndex =
            r.findIndex(
                runner =>
                    runner.group !==
                    w[i].group
            );


        if (
            runnerIndex === -1
        ) {
            runnerIndex = i;
        }


        const runner =
            r.splice(
                runnerIndex,
                1
            )[0];


        pairs.push([
            w[i].id,
            runner.id
        ]);
    }


    return pairs;
}


/* =========================================================
   HISTORY
========================================================= */

function addToHistory(tournament) {

    if (!tournament) return;


    const copy =
        clone(tournament);


    state.history.unshift(copy);


    if (
        state.history.length >
        30
    ) {

        state.history =
            state.history.slice(
                0,
                30
            );
    }
}


function renderHistory() {

    const list =
        document.getElementById(
            "historyList"
        );


    if (!list) return;


    const all = [];


    if (state.league) {
        all.push(state.league);
    }

    if (state.groups) {
        all.push(state.groups);
    }

    if (state.knockout) {
        all.push(state.knockout);
    }


    all.push(
        ...state.history
    );


    all.sort(
        (a, b) =>
            new Date(b.createdAt) -
            new Date(a.createdAt)
    );


    if (!all.length) {

        list.innerHTML = `

            <div
                class="empty-state"
                style="grid-column:1/-1">

                <div>📋</div>

                <strong>
                    السجل فارغ
                </strong>

                <span>
                    ستظهر البطولات السابقة هنا.
                </span>

            </div>

        `;

        return;
    }


    list.innerHTML =
        all
            .slice(0, 30)
            .map(
                tournament => {

                    let type =
                        "TOURNAMENT";

                    if (
                        tournament.type ===
                        "league"
                    ) {
                        type = "LEAGUE";
                    }

                    if (
                        tournament.type ===
                        "groups"
                    ) {
                        type = "GROUP STAGE";
                    }

                    if (
                        tournament.type ===
                        "knockout"
                    ) {
                        type = "KNOCKOUT";
                    }


                    let champion =
                        tournament.champion
                            ? teamName(
                                tournament.champion
                            )
                            : "لم تنتهِ بعد";


                    return `

                        <div class="history-card">

                            <div class="history-card-top">

                                <span class="history-type">
                                    ${type}
                                </span>

                                <small
                                    style="color:#68728b;font-size:8px">

                                    ${formatDate(
                                        tournament.createdAt
                                    )}

                                </small>

                            </div>


                            <h3>
                                ${escapeHTML(
                                    tournament.name
                                )}
                            </h3>


                            <p>
                                ${
                                    tournament.teams
                                        ?.length ||
                                    0
                                }
                                فرق
                            </p>


                            <div class="history-champion">

                                🏆
                                ${
                                    escapeHTML(
                                        champion
                                    )
                                }

                            </div>

                        </div>

                    `;
                }
            )
            .join("");
}


/* =========================================================
   DASHBOARD
========================================================= */

function countAllMatches() {

    let total = 0;


    if (state.league) {

        total +=
            totalMatchesFromRounds(
                state.league.rounds
            );
    }


    if (state.groups) {

        state.groups.groups
            .forEach(group => {

                total +=
                    totalMatchesFromRounds(
                        group.rounds
                    );

            });
    }


    if (state.knockout) {

        total +=
            totalMatchesFromRounds(
                state.knockout.rounds
            );
    }


    return total;
}


function updateDashboard() {

    const teams =
        document.getElementById(
            "statTeams"
        );

    const tournaments =
        document.getElementById(
            "statTournaments"
        );

    const matches =
        document.getElementById(
            "statMatches"
        );

    const draws =
        document.getElementById(
            "statDraws"
        );


    if (!teams) return;


    teams.textContent =
        state.teams.length;


    tournaments.textContent =
        state.history.length +
        Number(!!state.league) +
        Number(!!state.groups) +
        Number(!!state.knockout);


    matches.textContent =
        countAllMatches();


    draws.textContent =
        state.draws;


    renderRecent();
}


function renderRecent() {

    const container =
        document.getElementById(
            "recentTournaments"
        );


    if (!container) return;


    const recent = [];


    if (state.league) {
        recent.push(state.league);
    }

    if (state.groups) {
        recent.push(state.groups);
    }

    if (state.knockout) {
        recent.push(state.knockout);
    }


    recent.push(
        ...state.history
    );


    recent.sort(
        (a, b) =>
            new Date(b.createdAt) -
            new Date(a.createdAt)
    );


    if (!recent.length) {

        container.innerHTML = `

            <div class="empty-state small">

                <div>🏆</div>

                <strong>
                    لا توجد بطولات بعد
                </strong>

                <span>
                    أنشئ أول بطولة لك وابدأ المنافسة.
                </span>

            </div>

        `;

        return;
    }


    container.innerHTML =
        recent
            .slice(0, 5)
            .map(
                tournament => {

                    const type =
                        tournament.type ===
                        "league"
                            ? "🏆 دوري"
                            : tournament.type ===
                              "groups"
                                ? "👥 مجموعات"
                                : "⚔️ إقصائي";


                    return `

                        <div class="history-card"
                             style="
                                display:flex;
                                align-items:center;
                                gap:12px;
                                padding:13px 15px;
                             ">

                            <div class="global-team-avatar">
                                ${type.split(" ")[0]}
                            </div>

                            <div
                                style="
                                    min-width:0;
                                    flex:1;
                                ">

                                <strong
                                    style="
                                        display:block;
                                        font-size:10px;
                                        overflow:hidden;
                                        white-space:nowrap;
                                        text-overflow:ellipsis;
                                    ">

                                    ${escapeHTML(
                                        tournament.name
                                    )}

                                </strong>

                                <small
                                    style="
                                        display:block;
                                        margin-top:4px;
                                        color:#737d96;
                                        font-size:8px;
                                    ">

                                    ${type}
                                    ·
                                    ${formatDate(
                                        tournament.createdAt
                                    )}

                                </small>

                            </div>

                            <span
                                style="
                                    color:#ffd23f;
                                    font-size:18px;
                                ">

                                ›

                            </span>

                        </div>

                    `;
                }
            )
            .join("");
}


/* =========================================================
   RESET
========================================================= */

document
    .getElementById("resetAppBtn")
    ?.addEventListener(
        "click",
        () => {

            const confirmed =
                confirm(
                    "هل أنت متأكد؟ سيتم حذف جميع الفرق والبطولات والنتائج."
                );


            if (!confirmed) return;


            state =
                structuredClone(
                    defaultState
                );


            localStorage.removeItem(
                STORAGE_KEY
            );


            tempTeams.league = [];
            tempTeams.groups = [];
            tempTeams.knockout = [];


            document
                .getElementById(
                    "leagueName"
                ).value = "";

            document
                .getElementById(
                    "groupsName"
                ).value = "";

            document
                .getElementById(
                    "knockoutName"
                ).value = "";


            renderAllTeamLists();

            renderGlobalTeams();

            renderLeague();

            renderGroups();

            renderKnockout();

            renderHistory();

            updateDashboard();

            showPage("dashboard");


            showToast(
                "تمت إعادة ضبط التطبيق بالكامل",
                "success",
                "↻"
            );
        }
    );


/* =========================================================
   TABS
========================================================= */

document.addEventListener(
    "click",
    event => {

        const tab =
            event.target.closest(
                "[data-league-tab]"
            );

        if (!tab) return;


        document
            .querySelectorAll(
                "[data-league-tab]"
            )
            .forEach(item => {

                item.classList.toggle(
                    "active",
                    item === tab
                );

            });


        const wanted =
            tab.dataset.leagueTab;


        document
            .getElementById(
                "leagueMatchesTab"
            )
            .classList.toggle(
                "active",
                wanted === "matches"
            );


        document
            .getElementById(
                "leagueTableTab"
            )
            .classList.toggle(
                "active",
                wanted === "table"
            );

    }
);


/* =========================================================
   AUTO SAVE
========================================================= */

window.addEventListener(
    "beforeunload",
    saveState
);


/* =========================================================
   INITIALIZE
========================================================= */

function initialize() {

    renderGlobalTeams();

    renderAllTeamLists();

    renderLeague();

    renderGroups();

    renderKnockout();

    renderHistory();

    updateDashboard();

}


initialize();


console.log(
    "BRAWL TOURNAMENTS loaded successfully."
);