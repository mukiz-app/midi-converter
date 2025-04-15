import { useTheme } from "@emotion/react"
import { renderAudio, SoundFontSynth } from "@signal-app/player"
import { doc, getFirestore, setDoc, Timestamp } from "firebase/firestore"
import ContentSave from "mdi-react/ContentSaveIcon"
import { observer } from "mobx-react-lite"
import { FC, useRef, useState } from "react"
import { app } from "../../firebase/firebase"
import { encodeMp3 } from "../../helpers/encodeAudio"
import { useStores } from "../../hooks/useStores"
import { Localized } from "../../localize/useLocalization"
import { songToMidi } from "../../midi/midiConversion"
import { collectAllEvents } from "../../player/collectAllEvents"
import Song from "../../song"
import { Menu, MenuItem } from "../ui/Menu"
import { Tab } from "./Navigation"

export const SaveButton: FC = observer(() => {
  const { song, synth, trackMute } = useStores()
  const theme = useTheme()
  const searchParams = new URLSearchParams(window.location.search)
  const trackId = searchParams.get("trackId")
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  console.log("Track ID:", trackId) // Debug log

  async function uploadMp3File(song: Song, synth: SoundFontSynth, trackId: string, indexValue?: number): Promise<string> {
    // Get signed URL for MP3
    const mp3FilePath = `mp3/${trackId}_${(indexValue !== undefined) ? indexValue : ""}.mp3`
    const mp3SignedUrl = await getSignedUrlGCS(mp3FilePath, 'mukiz-midi', 'audio/mp3')
    console.log("MP3 Signed URL:", mp3SignedUrl)

    // Generate and upload MP3
    const soundFontData = synth.loadedSoundFontData
    if (soundFontData === null) {
      throw new Error("SoundFont data not loaded")
    }

    const sampleRate = 44100

    // Filter events to only include those from non-muted tracks
    const nonMutedTracks = song.tracks.filter(track => trackMute.shouldPlayTrack(track.id))
    const events = collectAllEvents(nonMutedTracks)

    const audioBuffer = await renderAudio(
      soundFontData,
      events,
      song.timebase,
      sampleRate,
      {
        bufferSize: 128,
        cancel: () => false,
        waitForEventLoop: () => Promise.resolve(),
        onProgress: () => { },
      }
    )

    const mp3Data = await encodeMp3(audioBuffer)
    const mp3Blob = new Blob([mp3Data], { type: "audio/mp3" })
    await uploadToGCS(mp3SignedUrl, 'audio/mp3', mp3Blob)
    return mp3SignedUrl
  }

  const handleSave = async (indexValue?: number) => {
    if (!trackId) {
      console.error("No track ID provided")
      return
    }

    try {
      const db = getFirestore(app)
      const songRef = doc(db, "track", trackId)
      if (songRef.id === undefined) {
        alert("No track id")
        return
      }

      // Upload MIDI and full MP3 files to GCS
      if (indexValue === undefined) {
        const midiSignedUrl = await uploadMidiFile(song, trackId)
        const mp3SignedUrl = await uploadMp3File(song, synth, trackId)
        const songData = {
          updated_date: Timestamp.now(),
          midi_cover: {
            midi_url: midiSignedUrl,
            mp3_url: mp3SignedUrl
          }
        }

        // Update Firestore document with file references
        await setDoc(songRef, songData, { merge: true })
        console.log("Song saved for full track")
      } else {
        const mp3SignedUrl = await uploadMp3File(song, synth, trackId, indexValue)
        const songData = {
          updated_date: Timestamp.now(),
          midi_cover: {
            [`extract_${indexValue}_url`]: mp3SignedUrl
          }
        }

        // Update Firestore document with file references
        await setDoc(songRef, songData, { merge: true })
        console.log("Song saved for extract " + indexValue)
      }


      song.isSaved = true
      setIsOpen(false)
      alert("Song saved")
    } catch (error) {
      console.error("Error saving song:", error)
    }
  }

  return (
    <Menu
      open={isOpen}
      onOpenChange={setIsOpen}
      trigger={
        <Tab ref={ref} id="tab-save">
          <ContentSave size={20} color={theme.textColor} />
          <Localized name="save-song" />
        </Tab>
      }
    >
      <MenuItem onClick={() => handleSave()}>Full Track</MenuItem>
      <MenuItem onClick={() => handleSave(0)}>Extract Track 1</MenuItem>
      <MenuItem onClick={() => handleSave(1)}>Extract Track 2</MenuItem>
      <MenuItem onClick={() => handleSave(2)}>Extract Track 3</MenuItem>
      <MenuItem onClick={() => handleSave(3)}>Extract Track 4</MenuItem>
    </Menu>
  )
})

async function uploadMidiFile(song: Song, trackId: string): Promise<string> {
  // Convert song to MIDI
  const midiData = songToMidi(song)
  const midiBlob = new Blob([midiData], { type: "audio/midi" })

  // Get signed URL for MIDI
  const midiFilePath = `midi/${trackId}.mid`
  const midiSignedUrl = await getSignedUrlGCS(midiFilePath, 'mukiz-midi', 'audio/midi')
  console.log("MIDI Signed URL:", midiSignedUrl)

  // Upload MIDI to Google Cloud Storage
  await uploadToGCS(midiSignedUrl, 'audio/midi', midiBlob)
  return midiSignedUrl
}

/**
 *  This is used for requesting an Upload URL to GCS before uploading a file to this URL
 * */
async function getSignedUrlGCS(filename: string, bucket_name: string, contentType: string) {
  try {
    const response = await fetch("https://us-central1-mukiz-231605.cloudfunctions.net/file-saveFileToBucket", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: {
          filename: filename,
          bucketName: bucket_name,
          contentType: contentType
        }
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const data = await response.json();
    return data.result[0]; // Return the first URL from the result array
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

/**
 *  This is used for uploading a file to an upload URL
 * */
async function uploadToGCS(url: string, contentType: string, file: Blob) {
  try {
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": contentType,
      },
      body: file,
    });

    if (!response.ok) {
      throw new Error(`Upload failed with status: ${response.status}`);
    }
  } catch (error) {
    console.error("An error occurred during upload:", error);
    throw error;
  }
}