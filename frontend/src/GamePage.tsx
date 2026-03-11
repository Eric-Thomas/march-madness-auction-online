import { Typography, Chip } from "@mui/joy";
import { Grid, Paper, Card } from "@mui/material";
import { useLocation } from "react-router-dom";
import React, { useEffect, useState } from "react";

import AuctionBiddingPanel from "./AuctionBiddingPanel";
import Bracket from "./Bracket";
import { PlayerInfo, TeamInfo, BACKEND_WS_URL, normalizeTeamKey } from "./Utils";

import "./css/App.css";
import "./css/Fonts.css";
import "./css/GamePage.css";

type WebSocketMessage = {
    players?: Map<string, PlayerInfo>;
    bid?: number;
    current_bidder?: string;
    countdown?: number;
    team?: TeamInfo;
    log?: string;
    remaining?: TeamInfo[];
    all_teams?: TeamInfo[];
};

interface PlayersRailProps {
    players: Array<[string, PlayerInfo]>;
    expandedPlayerName: string | null;
    currentBidder: string;
    onTogglePlayer: (playerName: string) => void;
}

function formatCurrency(value?: number) {
    if (value === undefined || Number.isNaN(value)) {
        return "--";
    }

    return `$${Math.max(0, Math.round(value)).toLocaleString()}`;
}

function getTeamLogoUrl(urlName?: string) {
    return urlName
        ? `https://i.turner.ncaa.com/sites/default/files/images/logos/schools/bgl/${urlName}.svg`
        : "";
}

function getTeamCountLabel(teamCount: number) {
    return `${teamCount} TEAM${teamCount === 1 ? "" : "S"}`;
}

function PlayersRail(props: PlayersRailProps) {
    return (
        <aside className="player-rail" aria-label="Players">
            <div className="player-rail__header">
                <h2 className="player-rail__title">PLAYERS ({props.players.length})</h2>
            </div>

            <div className="player-rail__list">
                {props.players.length > 0 ? (
                    props.players.map(([playerName, playerInfo], index) => {
                        const isExpanded = props.expandedPlayerName === playerName;
                        const isHighestBidder = Boolean(props.currentBidder) && props.currentBidder === playerName;
                        const teamCount = playerInfo.teams.length;

                        return (
                            <button
                                type="button"
                                key={playerName}
                                className={[
                                    "player-rail__card",
                                    isExpanded ? "player-rail__card--expanded" : "",
                                    isHighestBidder ? "player-rail__card--leader" : "",
                                ]
                                    .filter(Boolean)
                                    .join(" ")}
                                onClick={() => props.onTogglePlayer(playerName)}
                                aria-expanded={isExpanded}
                            >
                                <div className="player-rail__card-shell">
                                    <div className="player-rail__summary">
                                        <div className="player-rail__identity">
                                            <div className="player-rail__copy">
                                                <div className="player-rail__name-line">
                                                    <span className="player-rail__name">{playerName.toUpperCase()}</span>
                                                </div>

                                                <div className="player-rail__meta-line">
                                                    <span
                                                        className={[
                                                            "player-rail__balance",
                                                            playerInfo.balance < 25 ? "player-rail__balance--danger" : "",
                                                        ]
                                                            .filter(Boolean)
                                                            .join(" ")}
                                                    >
                                                        {formatCurrency(playerInfo.balance)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="player-rail__actions">
                                            <span className="player-rail__badge">{getTeamCountLabel(teamCount)}</span>
                                            {isHighestBidder ? (
                                                <span className="player-rail__leader-tag">LEAD</span>
                                            ) : null}
                                        </div>
                                    </div>

                                    <div className="player-rail__details">
                                        <div className="player-rail__details-inner">
                                            <div className="player-rail__details-label">Owned Teams</div>
                                            {teamCount > 0 ? (
                                                playerInfo.teams.map((team, teamIndex) => {
                                                    const teamLogoUrl = getTeamLogoUrl(team.urlName);

                                                    return (
                                                        <div className="player-rail__team-row" key={`${playerName}_${team.shortName}_${teamIndex}`}>
                                                            <div className="player-rail__team-main">
                                                                <span className="player-rail__team-logo-shell" aria-hidden="true">
                                                                    {teamLogoUrl ? (
                                                                        <img
                                                                            className="player-rail__team-logo"
                                                                            src={teamLogoUrl}
                                                                            alt=""
                                                                            loading="lazy"
                                                                            onError={(event) => {
                                                                                event.currentTarget.style.display = "none";
                                                                            }}
                                                                        />
                                                                    ) : (
                                                                        <span className="player-rail__team-logo-fallback">{team.shortName.trim().charAt(0).toUpperCase() || "?"}</span>
                                                                    )}
                                                                </span>

                                                                <span className="player-rail__team-copy">
                                                                    <span className="player-rail__team-name">{team.shortName.toUpperCase()}</span>
                                                                    {team.seed > 0 ? (
                                                                        <span className="player-rail__team-seed">#{team.seed}</span>
                                                                    ) : null}
                                                                </span>
                                                            </div>

                                                            <span className="player-rail__team-price">{formatCurrency(team.purchasePrice)}</span>
                                                        </div>
                                                    );
                                                })
                                            ) : (
                                                <p className="player-rail__empty-copy">No teams owned yet.</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </button>
                        );
                    })
                ) : (
                    <p className="player-rail__empty-copy player-rail__empty-copy--panel">No players yet.</p>
                )}
            </div>
        </aside>
    );
}

function useGameWebSocket(gameId: string) {
    const [wsData, setWsData] = useState<WebSocketMessage>({});
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const ws = new WebSocket(`${BACKEND_WS_URL}/ws/${gameId}`);

        ws.onerror = (error) => {
            setError("WebSocket connection error");
            console.error("WebSocket error:", error);
        };

        ws.onclose = () => {
            setError("WebSocket connection closed");
        };

        ws.onmessage = (event) => {
            if (event.data === "gameStarted") {
                // ignore
            }
            else {
                try {
                    const data: WebSocketMessage = JSON.parse(event.data);
                    console.log("DATA", data);
                    if ("players" in data && data.players) {
                        const players = new Map<string, PlayerInfo>();
                        Object.entries(data.players).forEach(([key, temp_player]: [string, any]) => {
                            players.set(key, {
                                name: temp_player.name,
                                gameId: temp_player.gameId,
                                balance: parseInt(temp_player.balance),
                                points: parseInt(temp_player.points),
                                teams: Object.values(temp_player.teams).map((temp_team: any) => {
                                    return {
                                        shortName: temp_team.shortName,
                                        urlName: temp_team.urlName,
                                        seed: temp_team.seed,
                                        region: temp_team.region,
                                        purchasePrice: temp_team.purchasePrice
                                    };
                                }),
                            });
                        });
                        setWsData((prev: WebSocketMessage) => ({ ...prev, players }));
                    }
                    else if ("bid" in data) {
                        setWsData((prev: WebSocketMessage) => ({ ...prev, bid: data["bid"] }));
                    }
                    else if ("current_bidder" in data) {
                        setWsData((prev: WebSocketMessage) => ({ ...prev, current_bidder: data["current_bidder"] || "" }));
                    }
                    else if ("countdown" in data) {
                        setWsData((prev: WebSocketMessage) => ({ ...prev, countdown: data["countdown"] }));
                    }
                    else if ("team" in data && data.team) {
                        const team = data.team as TeamInfo;
                        setWsData((prev: WebSocketMessage) => ({
                            ...prev, team: {
                                shortName: team.shortName,
                                urlName: team.urlName,
                                seed: team.seed,
                                region: team.region
                            }
                        }));
                    }
                    else if ("log" in data) {
                        setWsData((prev: WebSocketMessage) => ({ ...prev, log: data["log"] }));
                    }
                    else if ("remaining" in data && data.remaining) {
                        const remaining_teams: TeamInfo[] = data.remaining.map((temp_team: { [key: string]: any }) => {
                            return {
                                shortName: temp_team["shortName"],
                                urlName: temp_team["urlName"],
                                seed: temp_team["seed"],
                                region: temp_team["region"]
                            };
                        });
                        setWsData((prev: WebSocketMessage) => ({ ...prev, remaining: remaining_teams }));
                    }
                    else if ("all_teams" in data && data.all_teams) {
                        const all_teams: TeamInfo[] = data.all_teams.map((temp_team: { [key: string]: any }) => {
                            return {
                                shortName: temp_team["shortName"],
                                urlName: temp_team["urlName"],
                                seed: temp_team["seed"],
                                region: temp_team["region"]
                            };
                        });
                        setWsData((prev: WebSocketMessage) => ({ ...prev, all_teams }));
                    }
                } catch (error) {
                    console.error("Error parsing WebSocket message:", error);
                    setError("Invalid message format received");
                }
            }
        };
        return () => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.close();
            }
        };
    }, [gameId]);

    return { wsData, error };
}

function GamePage() {
    const location = useLocation();
    const { gameId, playerName } = location.state || {};

    const [currentHighestBid, setCurrentHighestBid] = useState<number>(0);
    const [currentBidder, setCurrentBidder] = useState("");
    const [countdown, setCountdown] = useState(10);
    const [playerInfos, setPlayerInfos] = useState<Map<string, PlayerInfo>>(new Map());
    const [team, setTeam] = useState<TeamInfo>({ shortName: "", urlName: "", seed: -1, region: "" });
    const [remainingTeams, setRemainingTeams] = useState<TeamInfo[]>([]);
    const [allTeams, setAllTeams] = useState<TeamInfo[]>([]);
    const [expandedPlayerName, setExpandedPlayerName] = useState<string | null>(null);
    const [copyState, setCopyState] = useState<"idle" | "copied">("idle");

    const panelSurface = {
        backgroundColor: "rgba(9, 12, 17, 0.72)",
        border: 1,
        borderColor: "rgba(255, 255, 255, 0.12)",
        borderRadius: "22px",
        boxShadow: "0px 18px 42px rgba(0, 0, 0, 0.28)",
        backdropFilter: "blur(12px)",
        color: "#f5eee6"
    };

    const { wsData, error } = useGameWebSocket(gameId);

    useEffect(() => {
        if (wsData.team) {
            setCurrentHighestBid(0);
            setCurrentBidder("");
        }
    }, [wsData.team]);

    useEffect(() => {
        if (wsData.players !== undefined) {
            setPlayerInfos(wsData.players);
        }
        if (wsData.bid !== undefined) {
            setCurrentHighestBid(wsData.bid);
        }
        if (wsData.current_bidder !== undefined) {
            setCurrentBidder(wsData.current_bidder);
        }
        if (wsData.countdown !== undefined) {
            setCountdown(wsData.countdown);
        }
        if (wsData.team !== undefined) {
            setTeam(wsData.team);
        }
        if (wsData.log !== undefined) {
            console.log("Auction log:", wsData.log);
        }
        if (wsData.remaining !== undefined) {
            setRemainingTeams(wsData.remaining);
        }
        if (wsData.all_teams !== undefined) {
            setAllTeams(wsData.all_teams);
        }
    }, [wsData.players, wsData.bid, wsData.current_bidder, wsData.countdown, wsData.team, wsData.log, wsData.remaining, wsData.all_teams, error]);

    useEffect(() => {
        if (expandedPlayerName && !playerInfos.has(expandedPlayerName)) {
            setExpandedPlayerName(null);
        }
    }, [expandedPlayerName, playerInfos]);

    const totalAuctions = allTeams.length === 65 ? 64 : allTeams.length;
    const auctionNumber = totalAuctions > 0
        ? Math.min(totalAuctions, Math.max(1, totalAuctions - remainingTeams.length + (team.shortName ? 1 : 0)))
        : 0;
    const activePlayerBalance = playerName ? (playerInfos.get(playerName)?.balance || 0) : 0;
    const orderedPlayers = Array.from(playerInfos.entries());
    const expandedPlayerTeams = expandedPlayerName ? (playerInfos.get(expandedPlayerName)?.teams || []) : [];
    const highlightedTeamKeys = Array.from(new Set(expandedPlayerTeams.map((ownedTeam) => normalizeTeamKey(ownedTeam)).filter(Boolean)));

    const handleTogglePlayer = (nextPlayerName: string) => {
        setExpandedPlayerName((currentPlayerName) => currentPlayerName === nextPlayerName ? null : nextPlayerName);
    };

    const handleCopyGameCode = async () => {
        if (!gameId || !navigator.clipboard) {
            return;
        }

        try {
            await navigator.clipboard.writeText(gameId);
            setCopyState("copied");
            window.setTimeout(() => setCopyState("idle"), 1400);
        } catch (copyError) {
            console.error("Unable to copy game code", copyError);
        }
    };

    return (
        <div id="outer-container" className="game-page-shell">
            <Paper
                elevation={0}
                sx={{
                    minHeight: "calc(100vh - 48px)",
                    width: "min(1640px, 100%)",
                    padding: 0,
                    overflow: "visible",
                    backgroundColor: "transparent",
                    boxShadow: "none"
                }}
            >
                <div className="graveyard-bracket__header game-page__top-rail">
                    <div className="graveyard-bracket__brand">
                        <div className="graveyard-bracket__brand-main">Bracket</div>
                        <div className="graveyard-bracket__brand-accent">Bloodbath</div>
                    </div>

                    <div className="graveyard-bracket__meta">
                        <div className="graveyard-bracket__meta-chip">
                            <span className="graveyard-bracket__meta-label">Game Code</span>
                            <span className="graveyard-bracket__meta-value">{gameId || "------"}</span>
                            <button type="button" className="graveyard-bracket__copy-button" onClick={handleCopyGameCode}>
                                {copyState === "copied" ? "Copied" : "Copy"}
                            </button>
                        </div>

                        <div className="graveyard-bracket__meta-chip graveyard-bracket__meta-chip--status">
                            <span className="graveyard-bracket__meta-label">Round 1</span>
                            <span className="graveyard-bracket__meta-divider">•</span>
                            <span className="graveyard-bracket__meta-label">Auction</span>
                            <span className="graveyard-bracket__meta-value">
                                {auctionNumber}/{totalAuctions || allTeams.length}
                            </span>
                        </div>
                    </div>
                </div>

                <Grid
                    container
                    spacing={2}
                    className="game-page__board"
                    sx={{ display: "flex", justifyContent: "center", alignItems: "flex-start", flexDirection: "row", minHeight: "100%" }}
                >
                    <Grid item xs={12} lg={2}>
                        <PlayersRail
                            players={orderedPlayers}
                            expandedPlayerName={expandedPlayerName}
                            currentBidder={currentBidder}
                            onTogglePlayer={handleTogglePlayer}
                        />
                    </Grid>

                    <Grid item xs={12} lg={8}>
                        <Grid container spacing={2} sx={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
                            <Grid item xs={12}>
                                <Card
                                    sx={{
                                        height: { xs: "540px", md: "760px", lg: "840px" },
                                        width: "100%",
                                        padding: 0,
                                        overflow: "hidden",
                                        backgroundColor: "transparent",
                                        border: 0,
                                        borderRadius: 0,
                                        boxShadow: "none"
                                    }}
                                >
                                    {allTeams.length > 0 ?
                                        <Bracket
                                            all_teams={allTeams}
                                            selected_team={team}
                                            highlightedTeamKeys={highlightedTeamKeys}
                                        />
                                        : <Typography sx={{ color: "white", padding: 2 }}>No teams available</Typography>
                                    }
                                </Card>
                            </Grid>
                        </Grid>
                    </Grid>

                    <Grid item xs={12} lg={2}>
                        <Card sx={{ ...panelSurface, minHeight: { xs: 320, lg: 760 }, maxHeight: { xs: "none", lg: 760 }, overflowY: "auto", width: "100%" }}>
                            <Grid container spacing={1} sx={{ flexWrap: "wrap", padding: 1 }}>
                                {remainingTeams.length > 0 ?
                                    remainingTeams.map((temp_team, i) => {
                                        const teamLogo = temp_team.region !== "region" ? getTeamLogoUrl(temp_team.urlName) : "";

                                        return (
                                            <Grid item key={i} xs="auto">
                                                <Chip sx={{ backgroundColor: "rgba(255, 255, 255, 0.08)", border: "1px solid rgba(255, 255, 255, 0.06)" }}>
                                                    <Typography sx={{ color: "#f6eee5", fontSize: "12px" }}>
                                                        {temp_team.region !== "region" && teamLogo && (
                                                            <img src={teamLogo} alt="" style={{ width: "10px", height: "10px", paddingRight: 4 }} />
                                                        )}
                                                        {temp_team.shortName} ({temp_team.seed})
                                                    </Typography>
                                                </Chip>
                                            </Grid>
                                        );
                                    })
                                    : <Typography>No teams available</Typography>
                                }
                            </Grid>
                        </Card>
                    </Grid>

                </Grid>

                <AuctionBiddingPanel
                    gameId={gameId}
                    playerName={playerName}
                    currentHighestBid={currentHighestBid}
                    currentBidder={currentBidder}
                    countdown={countdown}
                    balance={activePlayerBalance}
                    team={team}
                />
            </Paper>
        </div>
    );
}

export default GamePage;
