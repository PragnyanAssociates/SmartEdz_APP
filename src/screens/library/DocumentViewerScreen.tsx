import React from 'react';
import { View, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { WebView } from 'react-native-webview';

const DocumentViewerScreen = ({ route }) => {
    const { url } = route.params;

    // Android WebViews cannot display PDFs directly. 
    // We use Google Docs Viewer to render the PDF for viewing.
    // iOS WebViews can display PDFs directly.
    const viewerUrl = Platform.OS === 'android' 
        ? `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(url)}`
        : url;

    return (
        <View style={styles.container}>
            <WebView 
                source={{ uri: viewerUrl }} 
                startInLoadingState={true}
                renderLoading={() => (
                    <View style={styles.loading}>
                        <ActivityIndicator size="large" color="#2563EB" />
                    </View>
                )}
                style={{ flex: 1 }}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFF' },
    loading: { position: 'absolute', top: '50%', left: '50%', transform: [{translateX: -25}, {translateY: -25}] }
});

export default DocumentViewerScreen;