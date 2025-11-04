import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import StudentListScreen from './StudentListScreen';
import StudentDetailScreen from './StudentDetailScreen';

const Stack = createStackNavigator();

const StudentStackNavigator = () => {
    return (
        <Stack.Navigator
            screenOptions={{
                headerStyle: {
                    backgroundColor: '#3156bbff',
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
                options={{ headerShown: false, }}
            />
            <Stack.Screen
                name="StudentDetail"
                component={StudentDetailScreen}
                options={{
                    title: 'Student Profile',
                }}
            />
        </Stack.Navigator>
    );
};

export default StudentStackNavigator;