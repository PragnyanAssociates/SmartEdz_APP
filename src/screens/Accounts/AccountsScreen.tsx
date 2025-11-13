import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    SafeAreaView,
    FlatList,
    Image,
    Alert
} from 'react-native';

// Define the structure for each item in our accounts dashboard
interface AccountModule {
    id: string;
    title: string;
    imageSource: string;
    navigateTo: string; // Placeholder for navigation route name
}

// Data for the grid items with high-quality icons
const accountModules: AccountModule[] = [
    {
        id: 'acc1',
        title: 'Transactions',
        imageSource: 'https://cdn-icons-png.flaticon.com/128/9405/9405698.png',
        navigateTo: 'TransactionsScreen',
    },
    {
        id: 'acc2',
        title: 'Vouchers',
        imageSource: 'https://cdn-icons-png.flaticon.com/128/4306/4306892.png',
        navigateTo: 'VouchersScreen',
    },
    {
        id: 'acc3',
        title: 'Registers',
        imageSource: 'https://cdn-icons-png.flaticon.com/128/9875/9875512.png',
        navigateTo: 'RegistersScreen',
    },
    {
        id: 'acc4',
        title: 'Reports',
        imageSource: 'https://cdn-icons-png.flaticon.com/128/4149/4149706.png',
        navigateTo: 'ReportsScreen',
    },
    {
        id: 'acc5',
        title: 'Calendar',
        imageSource: 'https://cdn-icons-png.flaticon.com/128/16090/16090543.png',
        navigateTo: 'CalendarScreen',
    },
];

// Main Accounts Screen Component
const AccountsScreen = () => {

    // Function to handle navigation when a card is pressed
    const handleNavigation = (navigateTo: string) => {
        // You can replace this alert with your actual navigation logic
        // For example: navigation.navigate(navigateTo);
        Alert.alert(
            "Navigation",
            `Would navigate to the ${navigateTo} screen.`
        );
    };

    // This function renders each card in the grid
    const renderModuleCard = ({ item }: { item: AccountModule }) => (
        <TouchableOpacity
            style={styles.card}
            onPress={() => handleNavigation(item.navigateTo)}
        >
            <Image
                source={{ uri: item.imageSource }}
                style={styles.cardImage}
                resizeMode="contain"
            />
            <Text style={styles.cardTitle}>{item.title}</Text>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Accounts</Text>
            </View>

            <FlatList
                data={accountModules}
                renderItem={renderModuleCard}
                keyExtractor={(item) => item.id}
                // ★★★ MODIFIED: Changed number of columns to 2 ★★★
                numColumns={2}
                contentContainerStyle={styles.gridContainer}
            />
        </SafeAreaView>
    );
};

// ★★★ MODIFIED: Updated styles for a 2-column layout ★★★
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F7FAFC', // A light grey background
    },
    header: {
        paddingVertical: 20,
        paddingHorizontal: 16,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#1A202C',
    },
    gridContainer: {
        padding: 12, // Adjusted padding
    },
    card: {
        flex: 1,
        margin: 8, // Adjusted margin
        height: 150, // Increased height for better balance
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 16, // Slightly more rounded corners
        padding: 10,
        // iOS Shadow
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
        // Android Shadow
        elevation: 5,
    },
    cardImage: {
        width: 60, // Increased icon size
        height: 60, // Increased icon size
        marginBottom: 12,
    },
    cardTitle: {
        fontSize: 14, // Increased font size
        fontWeight: '600',
        color: '#4A5568',
        textAlign: 'center',
    },
});

export default AccountsScreen;