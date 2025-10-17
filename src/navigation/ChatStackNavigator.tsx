import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import GroupListScreen from '../screens/chat/GroupListScreen';
import GroupChatScreen from '../screens/chat/GroupChatScreen';
import CreateGroupScreen from '../screens/chat/CreateGroupScreen';

const Stack = createStackNavigator();

const ChatStackNavigator = () => {
    return (
        <Stack.Navigator>
            <Stack.Screen 
                name="GroupList" 
                component={GroupListScreen} 
                options={{ headerShown: false }}
            />
            <Stack.Screen 
                name="GroupChat" 
                component={GroupChatScreen} 
                options={{ headerShown: false }}
            />
            <Stack.Screen 
                name="CreateGroup" 
                component={CreateGroupScreen} 
                options={{ 
                    presentation: 'modal', 
                    headerShown: true, 
                    title: 'Create New Group',
                }} 
            />
        </Stack.Navigator>
    );
};

export default ChatStackNavigator;