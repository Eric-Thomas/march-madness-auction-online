import { Typography, List, ListItem, Chip } from "@mui/joy";
import { Grid, Paper, Card, Fab, Snackbar, Alert } from "@mui/material";
import { useLocation } from "react-router-dom";
import React, { useState, useEffect, useRef } from "react";

import Bid from "./Bid";
import Bracket from "./Bracket";
import { TeamData } from "./Utils"
import { ReactComponent as CrownIcon } from "./icons/crown.svg";
import { ReactComponent as UserIcon } from "./icons/user.svg";

import "./css/App.css";
import "./css/Fonts.css";

function GamePage() {
    const location = useLocation();
    const { gameId, playerName } = location.state || {};

    const [currentHighestBid, setCurrentHighestBid] = useState<number>(0);
    const [countdown, setCountdown] = useState(10);
    const [participants, setParticipants] = useState<string[]>([]);
    const [participantInfos, setParticipantsInfos] = useState<Record<string, any>>({});
    const [team, setTeam] = useState<TeamData>({name:"",seed:-1,region:""});
    const [remainingTeams, setRemainingTeams] = useState<TeamData[]>([]);
    const [allTeams, setAllTeams] = useState<TeamData[]>([]);
    const [log, setLog] = useState<string>("");

    const [openSnackbar, setOpenSnackbar] = React.useState(false);
    const handleCloseSnackbar = () => {
        setOpenSnackbar(false);
    };

    const baseColor = "#FFD700";

    const wsRef = useRef<WebSocket | null>(null); // Use useRef to hold the WebSocket connection
    useEffect(() => {
        const ws = new WebSocket(`ws://localhost:8000/ws/${gameId}`);
        wsRef.current = ws;

        ws.onmessage = (event) => {
        if (event.data === "gameStarted") {
            // ignore
        }
        else {
            const data = JSON.parse(event.data);
            console.log("DATA", data);
            if ("participants" in data) {
                setParticipants(Object.keys(data["participants"]));
                setParticipantsInfos(data["participants"]);
            }
            else if ("bid" in data) {
                setCurrentHighestBid(data["bid"]);
            }
            else if ("countdown" in data) {
                setCountdown(data["countdown"]);
            }
            else if ("team" in data) {
                setTeam({
                    name: data["team"][0],
                    seed: parseInt(data["team"][1]),
                    region: data["team"][2],
                });
            }
            else if ("log" in data) {
                setLog(data["log"]);
                setOpenSnackbar(true);
            }
            else if ("remaining" in data) {
                const remaining_teams: TeamData[] = data["remaining"].map((temp_team:string[], i:number) => {
                    return {
                        name: temp_team[0],         // Team name (index 0)
                        seed: parseInt(temp_team[1]), // Seed (index 1), converted to number
                        region: temp_team[2],       // Region (index 2)
                      };
                })
                setRemainingTeams(remaining_teams);
            }
            else if ("all_teams" in data) {
                const all_teams: TeamData[] = data["all_teams"].map((temp_team:string[], i:number) => {
                    return {
                        name: temp_team[0],         // Team name (index 0)
                        seed: parseInt(temp_team[1]), // Seed (index 1), converted to number
                        region: temp_team[2],       // Region (index 2)
                      };
                })
                setAllTeams(all_teams);
            }
        }
        };
        return () => ws.close();
    }, [gameId]);

    return (
        <div id="outer-container">
            <Paper elevation={1} sx={{height:"720px", width:"1400px", padding: "10px", backgroundColor: "#fcfcfc"}}>
                <Grid container spacing={1} sx={{ display: "flex", justifyContent: "center", alignItems: "center", flexDirection: "row", height: "calc(100vh - 60px)", minHeight: "100%" }}>
                    {/* Left side */}
                    <Grid item xs={10}>
                        <Grid container spacing={1} sx={{ display: "flex", justifyContent: "center", alignItems: "center"}}>

                            {/* Team to bid on */}
                            <Grid item xs={12} sx={{ display: "flex", justifyContent: "center", alignItems: "center"}}>
                                <Grid container spacing={1} sx={{ display: "flex", justifyContent: "center", alignItems: "center"}}>
                                    <Grid item>
                                        <Typography justifyContent="center" sx={{ color: "var(--tertiary-color)", fontFamily: "threeDim2", fontSize: "60px", marginTop: "-20px", marginBottom: "-20px" }}>
                                            {team.name}
                                        </Typography>
                                    </Grid>
                                    <Grid item>
                                        <Typography justifyContent="center" sx={{ color: "var(--tertiary-color)", fontSize: "40px", marginTop: "-38px", marginBottom: "-20px" }}>
                                            {team.seed ? `(${team.seed})`: ""}
                                        </Typography>
                                    </Grid>
                                </Grid>
                            </Grid>

                            {/* Display bracket */}
                            <Grid item xs={12} sx={{ display: "flex", justifyContent: "center", alignItems: "center"}}>
                                <Card sx={{ height: "540px", width: "100%", padding: "10px", backgroundColor: "white"}}>
                                    {allTeams.length > 0 ?
                                        <Bracket all_teams={allTeams} selected_team={team}/>
                                        : <Typography>No teams available</Typography>
                                    }
                                </Card>
                            </Grid>

                            <Grid item xs={12} sx={{ display: "flex", justifyContent: "center", alignItems: "center"}}>
                                <Card sx={{ height: "70px", width: "100%", padding: "10px", backgroundColor: "white"}}>
                                    <Grid container sx={{ justifyContent: "center", alignItems: "center" }}>

                                        {/* Spacing */}
                                        <Grid item xs={1} sx={{ display: "flex", justifyContent: "center", alignItems: "center"}}/>

                                        {/* Countdown timer */}
                                        <Grid item xs={1} sx={{ display: "flex", justifyContent: "center", alignItems: "center"}}>
                                            <Card sx={{ border: 5, height: "50px", width: "50px", backgroundColor: "black", borderRadius: 0, borderColor: "white"}}>
                                                <Typography sx={{ color: countdown <= 5 ? "red" : "white", textAlign: "center", fontFamily: "clock", fontSize: "45px", my:"-10px" }}>
                                                    {countdown.toString().padStart(2, "0")}
                                                </Typography>
                                            </Card>
                                        </Grid>

                                        {/* Bid */}
                                        <Grid item xs={6} sx={{ display: "flex", justifyContent: "center", alignItems: "center"}}>
                                            <Grid container spacing={2} sx={{ justifyContent: "center", alignItems: "center", flexDirection: "row" }}>
                                                <Grid item xs={12} sx={{ display: "flex", justifyContent: "center", alignItems: "center"}}>
                                                    <Typography level="h4" sx={{justifyContent:"center", my:"-10px"}}>
                                                        Current bid: ${currentHighestBid.toFixed(2)}
                                                    </Typography>
                                                </Grid>
                                                <Grid item xs={6} sx={{ display: "flex", justifyContent: "center", alignItems: "center"}}>
                                                    <Bid gameId={gameId} player={playerName} currentHighestBid={currentHighestBid} team={`${team.name} (${team.seed})`}/>
                                                </Grid>
                                            </Grid>
                                        </Grid>

                                        {/* Spacing */}
                                        <Grid item xs={2} sx={{ display: "flex", justifyContent: "center", alignItems: "center"}}/>

                                    </Grid>
                                </Card>
                            </Grid>
                        </Grid>
                    </Grid>

                    {/* Right side */}
                    <Grid item xs={2}>
                        <Grid container spacing={1} sx={{ display: "flex", justifyContent: "center", alignItems: "center"}}>

                            {/* Participants */}
                            <Grid item xs={12} sx={{ display: "flex", justifyContent: "center", alignItems: "center"}}>
                                <Card sx={{ height:200, overflowY: "auto", width: "100%", backgroundColor: "white"}}>
                                    <List sx={{ width: "100%" }}>
                                    {participants.length > 0 ?
                                        participants.map((participant, i) => {
                                        // Calculate hue based on index
                                        const hue = (i * 30) % 360; // Adjust 30 as needed to change the color spacing
                                        const participantColor = `hsl(${hue}, 70%, 50%)`; // Adjust saturation and lightness as needed

                                        return (
                                            <React.Fragment key={i}>
                                            <ListItem>
                                                {i === 0 ? <CrownIcon fill={baseColor} width="20px" height="20px" /> : <UserIcon fill={participantColor} width="20px" height="20px" />}
                                                <Chip sx={{ padding: "0 20px", backgroundColor: "var(--off-white-color)" }}>
                                                    <Typography sx={{ color: participantColor }}>
                                                        {participant}
                                                    </Typography>
                                                    <Typography sx={{ fontSize: "12px" }}>
                                                        Balance: $ {participantInfos[participant]["balance"].toFixed(2)}
                                                    </Typography>
                                                    <Typography sx={{ fontSize: "12px" }}>
                                                        Teams:
                                                    </Typography>
                                                    {participantInfos[participant]["teams"].map((temp_team:string, teamIndex:number) => (
                                                        <Typography key={teamIndex} sx={{ marginLeft: "10px", fontSize: "12px" }}>
                                                        - {temp_team}
                                                        </Typography>
                                                    ))}
                                                </Chip>
                                            </ListItem>
                                            </React.Fragment>
                                        );
                                        })
                                        : <Typography>No participants</Typography>
                                    }
                                    </List>
                                </Card>
                            </Grid>

                            {/* Remaining Teams */}
                            <Grid item xs={12} sx={{ display: "flex", justifyContent: "center", alignItems: "center"}}>
                                <Card sx={{ maxHeight: 510, overflowY: "auto", width: "100%", backgroundColor: "white"}}>
                                    <List sx={{ minWidth: 100, maxWidth: 300 }}>
                                        {remainingTeams.length > 0 ?
                                            remainingTeams.map((temp_team, i) => {
                                                return (
                                                    <React.Fragment key={i}>
                                                        <ListItem>
                                                            <Chip sx={{ backgroundColor: "var(--off-white-color)" }}>
                                                                <Typography sx={{ color: "black", fontSize: "12px" }}>
                                                                    {temp_team.name} ({temp_team.seed})
                                                                </Typography>
                                                            </Chip>
                                                        </ListItem>
                                                    </React.Fragment>
                                                );
                                            })
                                            : <Typography>No teams available</Typography>
                                        }
                                    </List>
                                </Card>
                            </Grid>
                        </Grid>
                    </Grid>

                    {/* Floating button showing number of teams remaining */}
                    <Grid item xs={12} sx={{ display: "flex", justifyContent: "right", alignItems: "right", marginTop: "-80px" }}>
                        <Fab variant="extended" size="small" sx={{backgroundColor:"var(--off-white-color)"}}>
                            <Typography justifyContent="center" sx={{fontSize: "12px"}}><b>Teams Remaining: {remainingTeams.length}</b></Typography>
                        </Fab>
                    </Grid>

                    {/* Display logs on the bottom */}
                    <Snackbar
                        open={openSnackbar}
                        onClose={handleCloseSnackbar}
                        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
                        >
                        <Alert
                            elevation={6}
                            variant="filled"
                            onClose={handleCloseSnackbar}
                            severity="info"
                        >
                            {log}
                        </Alert>
                    </Snackbar>
                </Grid>
            </Paper>
        </div>
    )
}

export default GamePage;
