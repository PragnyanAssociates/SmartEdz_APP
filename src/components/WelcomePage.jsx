import React, { useEffect, useRef } from 'react';
// Make sure ImageBackground is imported
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  SafeAreaView,
  Animated,
  Dimensions,
  ImageBackground 
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/AntDesign';

// Get screen dimensions for responsive design
const { width, height } = Dimensions.get('window');

const WelcomePage = () => {
  const navigation = useNavigation();

  // Animation values remain the same for a dynamic entry effect
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideUpAnim = useRef(new Animated.Value(50)).current;
  const logoScaleAnim = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.stagger(200, [
        Animated.spring(logoScaleAnim, {
          toValue: 1,
          friction: 4,
          useNativeDriver: true,
        }),
        Animated.spring(slideUpAnim, {
          toValue: 0,
          friction: 5,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [fadeAnim, slideUpAnim, logoScaleAnim]);


  const handleGetStarted = () => {
    navigation.navigate('HomeScreen');
  };

  // Animated styles remain the same
  const animatedContainerStyle = {
    opacity: fadeAnim,
  };
  const animatedLogoStyle = {
    opacity: fadeAnim,
    transform: [{ scale: logoScaleAnim }],
  };
  const animatedContentStyle = {
    opacity: fadeAnim,
    transform: [{ translateY: slideUpAnim }],
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ImageBackground
        source={require('../assets/background-4.jpg')}
        style={styles.backgroundImage}
        // resizeMode="cover"
        // CHANGE: The 'blurRadius' property has been removed from here.
      >
        {/* The overlay is still here to ensure text readability */}
        <Animated.View style={[styles.overlay, animatedContainerStyle]}>
          <Animated.Image
            source={require("../assets/logo.png")}
            style={[styles.logo, animatedLogoStyle]}
            resizeMode="contain"
          />
          <Animated.Text style={[styles.tagline, animatedContentStyle]}>
            The unified platform to manage your institution's resources and operations.
          </Animated.Text>
          <Animated.View style={animatedContentStyle}>
            <TouchableOpacity style={styles.button} onPress={handleGetStarted} activeOpacity={0.8}>
              <Text style={styles.buttonText}>Get Started</Text>
              <Icon name="arrowright" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </ImageBackground>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF', // Fallback color
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  // This overlay sits on top of the background image
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    // A semi-transparent white background makes content pop
    backgroundColor: 'rgba(255, 255, 255, 0.5)', 
  },
  logo: {
    width: 350,
    height: 300,
    marginBottom: -70,
  },
  tagline: {
    fontSize: 18,
    // Dark color for high contrast against the light overlay
    color: '#333333', 
    fontWeight: '500', // Slightly bolder for readability
    textAlign: 'center',
    lineHeight: 26,
    maxWidth: '95%',
    fontStyle: "italic",
    marginBottom: 60,
    margintop: 0,
    // Adding a subtle text shadow to lift it off the background
    textShadowColor: 'rgba(255, 255, 255, 0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  button: {
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 30,
    shadowColor: "#000000", // Shadow is more effective against an image
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 12,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginRight: 12,
  },
});

export default WelcomePage;