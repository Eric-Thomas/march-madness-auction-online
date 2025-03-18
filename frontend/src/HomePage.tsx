import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button, IconButton } from "@mui/joy";
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Grid, Alert } from "@mui/material";
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';

import { BACKEND_URL } from "./Utils"
import imageSrc from "./images/march_madness_logo_auction.png";
import "./css/Fonts.css";

const DIALOG_MODE = {
  CREATE: "CREATE",
  JOIN: "JOIN",
  VIEW: "VIEW"
};

function HomePage() {
  const navigate = useNavigate();
  const [dialogMode, setDialogMode] = useState(DIALOG_MODE.VIEW);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [playerName, setPlayerName] = useState("");
  const [gameId, setGameId] = useState("");
  const [dialogError, setDialogError] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasInteractedRef = useRef(false);

  useEffect(() => {
    // Create audio element
    audioRef.current = new Audio('/audio/metal.mp3');
    audioRef.current.loop = true;

    // Function to start audio
    const startAudio = async () => {
      try {
        if (audioRef.current && !isPlaying) {
          await audioRef.current.play();
          setIsPlaying(true);
          // Remove the event listeners after successful playback
          document.removeEventListener('click', handleFirstInteraction);
          document.removeEventListener('keypress', handleFirstInteraction);
          document.removeEventListener('scroll', handleFirstInteraction);
        }
      } catch (error) {
        console.error('Audio playback failed:', error);
      }
    };

    // Handler for first interaction
    const handleFirstInteraction = () => {
      if (!hasInteractedRef.current) {
        hasInteractedRef.current = true;
        startAudio();
      }
    };

    // Add event listeners for various user interactions
    document.addEventListener('click', handleFirstInteraction);
    document.addEventListener('keypress', handleFirstInteraction);
    document.addEventListener('scroll', handleFirstInteraction);

    // Cleanup on unmount
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('keypress', handleFirstInteraction);
      document.removeEventListener('scroll', handleFirstInteraction);
    };
  }, [isPlaying]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = isMuted;
    }
  }, [isMuted]);

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setDialogError("");
  };

  const handleCreateGameClick = () => {
    setDialogMode(DIALOG_MODE.CREATE);
    setIsDialogOpen(true);
  };

  const handleJoinGameClick = () => {
    setDialogMode(DIALOG_MODE.JOIN);
    setIsDialogOpen(true);
  };

  const handleViewGameClick = () => {
    setDialogMode(DIALOG_MODE.VIEW);
    setIsDialogOpen(true);
  };

  const handleCreateGame = async (event: React.FormEvent) => {
    setDialogError("");
    try {
      const response = await fetch(`http://${BACKEND_URL}/create-game/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ player: playerName }),
      });

      if (response.ok) {
        const data = await response.json();
        const createdGameId = data.id;
        navigate("/lobby", { state: { gameId: createdGameId, isCreator: true, playerName: playerName } });
      }
      // Handle error response
      else {
        console.error("Failed to create game:", response.statusText);
      }
    } catch (error) {
      console.error("Error creating game:", error);
    }
  };

  const handleJoinGame = async (event: React.FormEvent) => {
    setDialogError("");
    try {
      const response = await fetch(`http://${BACKEND_URL}/join-game/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ gameId: gameId, player: playerName }),
      });

      if (response.ok) {
        navigate("/lobby", { state: { gameId: gameId, isCreator: false, playerName: playerName } });
        setIsDialogOpen(false);
      }
      // Handle error response
      else {
        const responseData = await response.json();
        console.error("Error joining game:", responseData.detail);
        setDialogError(responseData.detail);
      }
    } catch (error) {
      console.error("Network error:", error);
    }
  };

  const handleViewGame = async (event: React.FormEvent) => {
    setDialogError("");
    try {
      const response = await fetch(`http://${BACKEND_URL}/view-game/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ gameId: gameId }),
      });

      if (response.ok) {
        navigate("/view", { state: { gameId: gameId } });
        setIsDialogOpen(false);
      }
      // Handle error response
      else {
        const responseData = await response.json();
        console.error("Error viewing game:", responseData.detail);
        setDialogError(responseData.detail);
      }
    } catch (error) {
      console.error("Network error:", error);
    }
  };

  return (
    <Grid container spacing={1} sx={{ display: "flex", justifyContent: "center", alignItems: "center", flexDirection: "column", height: "calc(100vh - 170px)", minHeight: "100%" }}>
      <Grid container spacing={2} sx={{ justifyContent: "center", alignItems: "center", flexDirection: "row" }}>

        {/* Create game button */}
        <Grid item>
          <Button sx={{ backgroundColor: "var(--primary-color)", color: "white" }} onClick={handleCreateGameClick}>Create Game</Button>
        </Grid>

        {/* March Madness logo */}
        <Grid item>
          <img src={imageSrc} alt="Central Game" style={{ maxWidth: "450px", margin: "20px 0" }} />
        </Grid>

        {/* Join game button */}
        <Grid item>
          <Button sx={{ backgroundColor: "var(--primary-color)", color: "white" }} onClick={handleJoinGameClick}>Join Game</Button>
        </Grid>
      </Grid>

      {/* View game button */}
      <Grid item>
        <Button sx={{ backgroundColor: "var(--primary-color)", color: "white" }} onClick={handleViewGameClick}>View Game</Button>
      </Grid>

      {/* Audio control button - positioned absolutely in bottom right */}
      <IconButton
        onClick={toggleMute}
        sx={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          backgroundColor: 'var(--primary-color)',
          color: 'white',
          '&:hover': {
            backgroundColor: 'var(--primary-color)',
            opacity: 0.8,
          }
        }}
      >
        {!isPlaying ? <PlayArrowIcon /> : (isMuted ? <VolumeOffIcon /> : <VolumeUpIcon />)}
      </IconButton>

      {/* Dialog to prompt user*/}
      <Dialog maxWidth="lg" open={isDialogOpen} onClose={handleCloseDialog}>

        {/* Dialog title */}
        <DialogTitle sx={{ textAlign: "center", fontFamily: "doubleFeature", }}>
          <b>{`${dialogMode} GAME`}</b>
        </DialogTitle>

        <DialogContent>
          {/* Display game error is any */}
          {dialogError ? <Alert severity="error">{dialogError}</Alert> : <></>}

          {/* Enter user name to create or join game */}
          {(dialogMode === DIALOG_MODE.CREATE || dialogMode === DIALOG_MODE.JOIN) ? <TextField fullWidth label="Your Name" value={playerName} onChange={(e) => setPlayerName(e.target.value)} margin="dense" /> : <></>}

          {/* Enter game id to join */}
          {(dialogMode === DIALOG_MODE.JOIN || dialogMode === DIALOG_MODE.VIEW) ? <TextField fullWidth label="Game ID" value={gameId} onChange={(e) => setGameId(e.target.value)} margin="dense" /> : <></>}
        </DialogContent>

        <DialogActions sx={{ justifyContent: "center" }}>
          <Button sx={{ backgroundColor: "var(--primary-color)", color: "white" }} onClick={handleCloseDialog}>Cancel</Button>

          {dialogMode === DIALOG_MODE.CREATE ? <Button sx={{ backgroundColor: "var(--primary-color)", color: "white" }} onClick={handleCreateGame}>Create</Button> : <></>}
          {dialogMode === DIALOG_MODE.JOIN ? <Button sx={{ backgroundColor: "var(--primary-color)", color: "white" }} onClick={handleJoinGame}>Join</Button> : <></>}
          {dialogMode === DIALOG_MODE.VIEW ? <Button sx={{ backgroundColor: "var(--primary-color)", color: "white" }} onClick={handleViewGame}>View</Button> : <></>}
        </DialogActions>
      </Dialog>
    </Grid>
  );
}

export default HomePage;
