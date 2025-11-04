import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import StudentListScreen from './StudentListScreen'; // Adjust path if necessary
import StudentDetailScreen from './StudentDetailScreen'; // Adjust path if necessary

const Stack = createStackNavigator();

const StudentStackNavigator = () => {
    return (
        <Stack.Navigator
            screenOptions={{
                headerStyle: {
                    backgroundColor: '#008080', // Or your app's primary color
                },
                headerTintColor: '#fff',
                headerTitleStyle: {
                    fontWeight: 'bold',
                },
            }}
        >
            <Stack.Screen
                name="StudentList"
                component={StudentListScreen}
                options={{ title: 'Student Directory' }}
            />
            <Stack.Screen
                name="StudentDetail"
                component={StudentDetailScreen}
                options={({ route }) => ({
                    title: 'Student Profile', // Title can be dynamic if needed
                })}
            />
        </Stack.Navigator>
    );
};

export default StudentStackNavigator;