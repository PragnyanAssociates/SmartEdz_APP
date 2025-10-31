// 📂 File: src/screens/labs/LabCard.tsx (REPLACE THIS FILE)

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Linking, Alert } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { SERVER_URL } from '../../../apiConfig';

// Updated Lab interface with all new fields
export interface Lab {
  id: number;
  title: string;
  subject: string;
  lab_type: string;
  class_group?: string | null;
  description: string;
  access_url: string | null;
  file_path: string | null;
  cover_image_url?: string | null;
  // New fields
  teacher_name?: string | null;
  topic?: string | null;
  video_url?: string | null;
  meet_link?: string | null;
  class_datetime?: string | null;
}

interface LabCardProps {
  lab: Lab;
  onEdit?: (lab: Lab) => void;
  onDelete?: (id: number) => void;
}

export const LabCard = ({ lab, onEdit, onDelete }: LabCardProps) => {
  const canManage = onEdit && onDelete;

  const handleOpenLink = async (url: string | null | undefined) => {
    if (!url) return;
    try {
        const supported = await Linking.canOpenURL(url);
        if (supported) { await Linking.openURL(url); } 
        else { Alert.alert("Error", `Cannot open this URL: ${url}`); }
    } catch (error) { Alert.alert("Error", "An unexpected error occurred."); }
  };

  const handleOpenFile = () => {
    if (!lab.file_path) return;
    const fileUrl = `${SERVER_URL}${lab.file_path}`;
    handleOpenLink(fileUrl);
  };

  const imageSource = lab.cover_image_url 
    ? { uri: `${SERVER_URL}${lab.cover_image_url}` }
    : require('../../assets/default-lab-icon.png');
  
  const formattedDateTime = lab.class_datetime 
    ? new Date(lab.class_datetime).toLocaleString()
    : null;

  return (
    <View style={styles.cardContainer}>
      <View style={styles.cardHeader}>
        <View style={styles.headerLeft}>
          <Image source={imageSource} style={styles.iconImage} />
          <View>
            <Text style={styles.title}>{lab.title}</Text>
            <Text style={styles.subtitle}>
              {lab.subject}{lab.topic ? ` - ${lab.topic}` : ''}
            </Text>
          </View>
        </View>
        {canManage && (
          <View style={styles.actionsContainer}>
            <TouchableOpacity onPress={() => onEdit(lab)} style={styles.actionBtn}>
              <MaterialIcons name="edit" size={18} color="#0277bd" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onDelete(lab.id)} style={styles.actionBtn}>
              <MaterialIcons name="delete" size={18} color="#d9534f" />
            </TouchableOpacity>
          </View>
        )}
      </View>
      
      <Text style={styles.metaInfo}>
        For: <Text style={styles.metaBold}>{lab.class_group || 'All Classes'}</Text>
        {lab.teacher_name && `  |  By: `}
        {lab.teacher_name && <Text style={styles.metaBold}>{lab.teacher_name}</Text>}
      </Text>

      {formattedDateTime && (
        <View style={styles.timeInfo}>
          <MaterialIcons name="event" size={16} color="#d84315" />
          <Text style={styles.timeText}>{formattedDateTime}</Text>
        </View>
      )}

      <Text style={styles.description}>{lab.description}</Text>
      
      <View style={styles.accessButtonsContainer}>
        {lab.file_path && (
          <TouchableOpacity style={[styles.accessButton, styles.fileButton]} onPress={handleOpenFile}>
            <MaterialIcons name="file-download" size={20} color="#fff" />
            <Text style={styles.accessButtonText}>Download File</Text>
          </TouchableOpacity>
        )}
        {lab.access_url && (
          <TouchableOpacity style={[styles.accessButton, styles.linkButton]} onPress={() => handleOpenLink(lab.access_url)}>
            <MaterialIcons name="launch" size={20} color="#fff" />
            <Text style={styles.accessButtonText}>Access Link</Text>
          </TouchableOpacity>
        )}
        {lab.video_url && (
          <TouchableOpacity style={[styles.accessButton, styles.videoButton]} onPress={() => handleOpenLink(lab.video_url)}>
            <MaterialIcons name="videocam" size={20} color="#fff" />
            <Text style={styles.accessButtonText}>Watch Video</Text>
          </TouchableOpacity>
        )}
        {lab.meet_link && (
          <TouchableOpacity style={[styles.accessButton, styles.meetButton]} onPress={() => handleOpenLink(lab.meet_link)}>
            <MaterialIcons name="groups" size={20} color="#fff" />
            <Text style={styles.accessButtonText}>Join Meet</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
    cardContainer: { backgroundColor: '#ffffff', borderRadius: 15, marginHorizontal: 15, marginVertical: 10, padding: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.1, shadowRadius: 6, elevation: 6, borderWidth: 1, borderColor: '#e0e0e0' },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10 },
    actionsContainer: { flexDirection: 'row', gap: 15 },
    actionBtn: { padding: 5 },
    iconImage: { width: 50, height: 50, borderRadius: 10, marginRight: 15 },
    title: { fontSize: 20, fontWeight: 'bold', color: '#263238', flexShrink: 1, marginBottom: 2 },
    subtitle: { fontSize: 14, color: '#546e7a', fontStyle: 'italic' },
    metaInfo: { fontSize: 14, color: '#546e7a', marginBottom: 8 },
    metaBold: { fontWeight: '600', color: '#37474f' },
    timeInfo: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff3e0', padding: 8, borderRadius: 8, marginBottom: 12 },
    timeText: { marginLeft: 8, color: '#d84315', fontWeight: 'bold', fontSize: 14 },
    description: { fontSize: 15, color: '#455a64', lineHeight: 22, marginBottom: 20 },
    accessButtonsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    accessButton: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 12, borderRadius: 10, flexGrow: 1, minWidth: '45%' },
    fileButton: { backgroundColor: '#5cb85c' },
    linkButton: { backgroundColor: '#0288d1' },
    videoButton: { backgroundColor: '#d32f2f' },
    meetButton: { backgroundColor: '#673ab7' },
    accessButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginLeft: 8 },
});