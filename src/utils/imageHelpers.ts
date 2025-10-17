import { SERVER_URL } from '../../apiConfig';
import { ImageSourcePropType } from 'react-native';

export const getProfileImageSource = (url?: string | null): ImageSourcePropType => {
  if (!url || typeof url !== 'string') {
    return require('../assets/default_avatar.png');
  }
  if (url.startsWith('http') || url.startsWith('file')) {
    return { uri: url };
  }
  const fullUrl = url.startsWith('/') ? `${SERVER_URL}${url}` : `${SERVER_URL}/${url}`;
  return { 
    uri: `${fullUrl}?t=${new Date().getTime()}`, 
  };
};