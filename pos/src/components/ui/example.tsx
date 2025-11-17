import React, { useState } from 'react';
import { Button, Input, Select, Badge, Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './index';
import { __ } from '../lib/i18n';

export const UIExample = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [selectValue, setSelectValue] = useState('');

  return (
    <div className="p-8 space-y-8">
      <h1 className="text-3xl font-bold">{__('UI Components Example')}</h1>
      
      {/* Button Examples */}
      <Card>
        <CardHeader>
          <CardTitle>{__('Buttons')}</CardTitle>
          <CardDescription>{__('Different button variants and sizes')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button variant="default">{__('Default')}</Button>
            <Button variant="secondary">{__('Secondary')}</Button>
            <Button variant="outline">{__('Outline')}</Button>
            <Button variant="ghost">{__('Ghost')}</Button>
            <Button variant="link">{__('Link')}</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="success">{__('Success')}</Button>
            <Button variant="warning">{__('Warning')}</Button>
            <Button variant="danger">{__('Danger')}</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="xs">{__('Extra Small')}</Button>
            <Button size="sm">{__('Small')}</Button>
            <Button size="default">{__('Default')}</Button>
            <Button size="lg">{__('Large')}</Button>
            <Button size="icon">{__('🚀')}</Button>
          </div>
        </CardContent>
      </Card>

      {/* Input Examples */}
      <Card>
        <CardHeader>
          <CardTitle>{__('Inputs')}</CardTitle>
          <CardDescription>{__('Different input variants and states')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">{__('Default Input')}</label>
              <Input 
                placeholder={__('Enter text...')} 
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">{__('Search Input')}</label>
              <Input 
                placeholder={__('Search...')} 
                variant="search"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">{__('Error Input')}</label>
              <Input 
                placeholder={__('Error state')} 
                variant="error"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">{__('Success Input')}</label>
              <Input 
                placeholder={__('Success state')} 
                variant="success"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Select Examples */}
      <Card>
        <CardHeader>
          <CardTitle>{__('Select')}</CardTitle>
          <CardDescription>{__('Select component with different states')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">{__('Default Select')}</label>
              <Select 
                value={selectValue}
                onChange={(e) => setSelectValue(e.target.value)}
              >
                <option value="">{__('Select an option')}</option>
                <option value="option1">{__('Option 1')}</option>
                <option value="option2">{__('Option 2')}</option>
                <option value="option3">{__('Option 3')}</option>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">{__('Error Select')}</label>
              <Select variant="error">
                <option value="">{__('Select an option')}</option>
                <option value="option1">{__('Option 1')}</option>
                <option value="option2">{__('Option 2')}</option>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Badge Examples */}
      <Card>
        <CardHeader>
          <CardTitle>{__('Badges')}</CardTitle>
          <CardDescription>{__('Status indicators and labels')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Badge variant="default">{__('Default')}</Badge>
            <Badge variant="secondary">{__('Secondary')}</Badge>
            <Badge variant="outline">{__('Outline')}</Badge>
            <Badge variant="success">{__('Success')}</Badge>
            <Badge variant="warning">{__('Warning')}</Badge>
            <Badge variant="danger">{__('Danger')}</Badge>
            <Badge variant="info">{__('Info')}</Badge>
            <Badge variant="pending">{__('Pending')}</Badge>
            <Badge variant="completed">{__('Completed')}</Badge>
            <Badge variant="cancelled">{__('Cancelled')}</Badge>
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            <Badge size="sm">{__('Small')}</Badge>
            <Badge size="default">{__('Default')}</Badge>
            <Badge size="lg">{__('Large')}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Dialog Example */}
      <Card>
        <CardHeader>
          <CardTitle>{__('Dialog')}</CardTitle>
          <CardDescription>{__('Modal dialog component')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => setDialogOpen(true)}>
            Open Dialog
          </Button>
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>{__('Example Dialog')}</DialogTitle>
            <DialogDescription>
              This is an example of the dialog component with all its features.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p>{__('This dialog demonstrates the usage of the Dialog component with header, content, and footer sections.')}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setDialogOpen(false)}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UIExample; 