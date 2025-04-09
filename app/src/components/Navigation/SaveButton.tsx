import { useTheme } from "@emotion/react"
import { renderAudio } from "@signal-app/player"
import { doc, getFirestore, setDoc, Timestamp } from "firebase/firestore"
import ContentSave from "mdi-react/ContentSaveIcon"
import { observer } from "mobx-react-lite"
import { FC } from "react"
import { app } from "../../firebase/firebase"
import { encodeMp3 } from "../../helpers/encodeAudio"
import { useStores } from "../../hooks/useStores"
import { Localized } from "../../localize/useLocalization"
import { songToMidi } from "../../midi/midiConversion"
import { MenuItem } from "../ui/Menu"

export const SaveButton: FC = observer(() => {
  const { song, synth } = useStores()
  const theme = useTheme()
  const searchParams = new URLSearchParams(window.location.search)
  const trackId = searchParams.get("trackId")
  console.log("Track ID:", trackId) // Debug log

  const handleSave = async () => {
    if (!trackId) {
      console.error("No track ID provided")
      return
    }

    try {
      // Convert song to MIDI
      const midiData = songToMidi(song)
      const midiBlob = new Blob([midiData], { type: "audio/midi" })

      // Get signed URL for MIDI
      const midiFilePath = `midi/${trackId}.mid`
      const midiSignedUrl = await getSignedUrlGCS(midiFilePath, 'mukiz-midi', 'audio/midi')
      console.log("MIDI Signed URL:", midiSignedUrl)

      // Upload MIDI to Google Cloud Storage
      await uploadToGCS(midiSignedUrl, 'audio/midi', midiBlob)

      // Get signed URL for MP3
      const mp3FilePath = `mp3/${trackId}.mp3`
      const mp3SignedUrl = await getSignedUrlGCS(mp3FilePath, 'mukiz-midi', 'audio/mp3')
      console.log("MP3 Signed URL:", mp3SignedUrl)

      // Generate and upload MP3
      const soundFontData = synth.loadedSoundFontData
      if (soundFontData === null) {
        throw new Error("SoundFont data not loaded")
      }

      const sampleRate = 44100
      const audioBuffer = await renderAudio(
        soundFontData,
        song.allEvents,
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

      // Update Firestore document with file references
      const songData = {
        updated_date: Timestamp.now(),
        midi_cover: {
          midi_url: midiSignedUrl,
          mp3_url: mp3SignedUrl
        }
      }

      const db = getFirestore(app)
      const songRef = doc(db, "songs", trackId)
      await setDoc(songRef, songData, { merge: true })

      song.isSaved = true
    } catch (error) {
      console.error("Error saving song:", error)
    }
  }

  return (
    <MenuItem onClick={handleSave}>
      <ContentSave size={20} color={theme.textColor} />
      <Localized name="save-song" />
    </MenuItem>
  )
})

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