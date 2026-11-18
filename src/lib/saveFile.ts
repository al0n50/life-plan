import { Platform, Share } from 'react-native';

/**
 * Hand a text file to the person. On the web it downloads; on phones it opens the share sheet
 * (save to Files, AirDrop, email to yourself...). No extra packages or network calls.
 */
export async function saveTextFile(filename: string, text: string, mime = 'application/json'): Promise<void> {
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([text], { type: mime }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  await Share.share({ title: filename, message: text });
}
