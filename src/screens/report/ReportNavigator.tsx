/**
 * File: src/screens/report/ReportNavigator.js
 * Purpose: Manages the navigation stack for the Report Card module.
 */
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

import ClassListScreen from './ClassListScreen';
import MarksEntryScreen from './MarksEntryScreen';
import StudentReportCardScreen from './StudentReportCardScreen';
import TeacherAssignmentScreen from './TeacherAssignmentScreen';

const Stack = createStackNavigator();

// Navigator for Teacher and Admin roles
const ReportNavigator = () => {
    return (
        <Stack.Navigator
            screenOptions={{
                headerStyle: { backgroundColor: '#e0f2f7' },
                headerTintColor: '#008080',
                headerTitleStyle: { fontWeight: 'bold' },
            }}
        >
            <Stack.Screen 
                name="ReportClassList" 
                component={ClassListScreen} 
                options={{ title: 'Select Class for Report Card' }} 
            />
            <Stack.Screen 
                name="MarksEntry" 
                component={MarksEntryScreen} 
                options={({ route }) => ({ title: `${route.params.classGroup} - Report Card` })}
            />
            <Stack.Screen 
                name="TeacherAssignment" 
                component={TeacherAssignmentScreen} 
                options={({ route }) => ({ title: `${route.params.classGroup} - Assign Teachers` })}
            />
        </Stack.Navigator>
    );
};


// Navigator for Student role
export const StudentReportNavigator = () => {
    return (
        <Stack.Navigator
            screenOptions={{
                headerStyle: { backgroundColor: '#e0f2f7' }, // Light teal theme
                headerTintColor: '#008080', // Dark teal text
                headerTitleStyle: { fontWeight: 'bold' },
            }}
        >
            <Stack.Screen
                name="StudentReportCard" // The name of the screen INSIDE this navigator
                
                // ★★★ THIS IS THE FIX ★★★
                // The component must be the actual screen component, not the navigator itself.
                component={StudentReportCardScreen} 
                
                options={{ title: 'My Progress Report' }}
            />
        </Stack.Navigator>
    );
};

export default ReportNavigator;